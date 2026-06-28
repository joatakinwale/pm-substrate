"""YouTube publisher — Data API v3.

Upload paths:
    1. **Multipart** (≤ 200 MB) — single POST with ``uploadType=multipart``;
       metadata + bytes bundled into one request. We download the source
       video into memory and upload in a single shot. Simple, low-overhead,
       fine for short-form.
    2. **Resumable** (> 200 MB, or unknown length) — two-step:
         a. POST /upload/youtube/v3/videos?uploadType=resumable with the
            metadata as JSON; response ``Location`` header is the upload URL.
         b. PUT the video bytes to that URL, streamed straight from the
            source without ever materializing them in memory.

The source video lives at ``post.media_urls[0]`` (R2 via a presigned URL
or a reachable public URL). For the resumable path we use
``httpx.stream()`` on the source GET and pipe ``iter_bytes()`` directly
into the YouTube PUT body — the video never touches Python memory or
disk on this worker.

Metrics come from /videos?part=statistics.

Docs: https://developers.google.com/youtube/v3/docs/videos/insert
"""

from __future__ import annotations

import json
import logging

import httpx

from app.models.social_media import SocialAccount, SocialPost

from .base import (
    MetricsResult,
    Publisher,
    PublisherError,
    PublishResult,
    build_platform_url,
    resolve_token,
)

logger = logging.getLogger(__name__)

API_ROOT = "https://www.googleapis.com"
UPLOAD_ROOT = "https://www.googleapis.com/upload"

# Cap for single-shot multipart upload. Beyond this we switch to the
# resumable path which streams bytes and has no practical upper bound
# (YouTube's own limit is 256 GB / 12 h per file).
MAX_INLINE_UPLOAD_BYTES = 200 * 1024 * 1024  # 200 MB

# Generous streaming timeout for very large uploads. At ~50 Mb/s this
# covers ~22 GB; bigger files would need multiple hours and the upstream
# request timeout would kick in first.
RESUMABLE_STREAM_TIMEOUT = httpx.Timeout(connect=30.0, read=3600.0, write=3600.0, pool=30.0)


class YouTubePublisher(Publisher):
    platform = "youtube"

    def publish(self, post: SocialPost, account: SocialAccount) -> PublishResult:
        token = resolve_token(account)

        media_urls = post.media_urls or []
        if not media_urls:
            return PublishResult(
                success=False,
                error="YouTube posts require a video URL",
            )

        title = ((post.caption or "").split("\n")[0] or "Untitled").strip()[:100]
        description = (post.caption or "").strip()
        if post.hashtags:
            description = description + "\n\n" + " ".join(
                t if t.startswith("#") else f"#{t}" for t in post.hashtags
            )

        metadata = {
            "snippet": {
                "title": title,
                "description": description[:5000],
                "tags": [t.lstrip("#") for t in (post.hashtags or [])][:15],
                "categoryId": "22",  # People & Blogs
            },
            "status": {
                "privacyStatus": "public",
                "selfDeclaredMadeForKids": False,
            },
        }

        # Probe source to decide which upload path to use. We HEAD first
        # so we don't pull 2 GB into RAM only to discover it's too big.
        source_url = media_urls[0]
        with httpx.Client(timeout=30.0, follow_redirects=True) as probe:
            head = probe.head(source_url)
            content_length = int(head.headers.get("content-length") or 0)

        if content_length and content_length <= MAX_INLINE_UPLOAD_BYTES:
            data = self._upload_multipart(source_url, token, metadata)
        else:
            # Unknown length OR known-too-large → resumable. The resumable
            # path streams without buffering, so unknown-length is safer
            # there anyway.
            data = self._upload_resumable(source_url, token, metadata, content_length)

        video_id = data.get("id")
        if not video_id:
            raise PublisherError(f"YouTube: no id in response: {data}")

        return PublishResult(
            success=True,
            platform_post_id=video_id,
            platform_url=build_platform_url("youtube", account, video_id),
            raw_response=data,
        )

    # ─── upload paths ────────────────────────────────────────────

    def _upload_multipart(self, source_url: str, token: str, metadata: dict) -> dict:
        """Single-shot multipart upload for small videos (≤200 MB).

        Downloads the full body into memory, wraps it in a multipart/related
        envelope with the metadata, and posts it as one request. Fast for
        short-form; bypass for larger files via ``_upload_resumable``.
        """
        with httpx.Client(timeout=120.0, follow_redirects=True) as client:
            download = client.get(source_url)
            if not download.is_success:
                raise PublisherError(
                    f"YouTube: could not fetch source video: HTTP {download.status_code}"
                )
            video_bytes = download.content

        boundary = "----StevieSocialBoundary9283741"
        body_parts: list[bytes] = [
            f"--{boundary}\r\n".encode(),
            b"Content-Type: application/json; charset=UTF-8\r\n\r\n",
            json.dumps(metadata).encode(),
            b"\r\n",
            f"--{boundary}\r\n".encode(),
            b"Content-Type: video/*\r\n\r\n",
            video_bytes,
            f"\r\n--{boundary}--\r\n".encode(),
        ]
        body = b"".join(body_parts)

        with httpx.Client(base_url=UPLOAD_ROOT, timeout=300.0) as client:
            r = client.post(
                "/youtube/v3/videos",
                params={"part": "snippet,status", "uploadType": "multipart"},
                content=body,
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": f"multipart/related; boundary={boundary}",
                },
            )
            if not r.is_success:
                logger.error("YouTube multipart upload failed: %s %s", r.status_code, r.text[:300])
                raise PublisherError(
                    f"YouTube upload: HTTP {r.status_code}: {r.text[:200]}"
                )
            return r.json()

    def _upload_resumable(
        self,
        source_url: str,
        token: str,
        metadata: dict,
        content_length: int,
    ) -> dict:
        """Resumable upload — the only viable path for videos > 200 MB.

        Two-step:
          1. POST the JSON metadata with ``uploadType=resumable`` and
             advisory ``X-Upload-Content-*`` headers. YouTube responds
             with a ``Location`` URL that is the upload session.
          2. PUT the video bytes to that Location. We stream directly
             from the source via ``httpx.stream()`` so no copy ever hits
             Python memory on this worker — important for 1–2 GB files
             and essential for anything bigger.

        If YouTube returns 308 (Resume Incomplete) we currently give up
        rather than restart from the last committed byte. That path is
        uncommon for single-PUT uploads and the social-publisher Worker
        retries the message, restarting the session.
        """
        metadata_bytes = json.dumps(metadata).encode()

        init_headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json; charset=UTF-8",
            "Content-Length": str(len(metadata_bytes)),
            "X-Upload-Content-Type": "video/*",
        }
        if content_length:
            init_headers["X-Upload-Content-Length"] = str(content_length)

        with httpx.Client(base_url=UPLOAD_ROOT, timeout=60.0) as client:
            init = client.post(
                "/youtube/v3/videos",
                params={"part": "snippet,status", "uploadType": "resumable"},
                content=metadata_bytes,
                headers=init_headers,
            )
            if not init.is_success:
                logger.error(
                    "YouTube resumable init failed: %s %s",
                    init.status_code,
                    init.text[:300],
                )
                raise PublisherError(
                    f"YouTube resumable init: HTTP {init.status_code}: {init.text[:200]}"
                )
            upload_url = init.headers.get("location") or init.headers.get("Location")
            if not upload_url:
                raise PublisherError(
                    "YouTube resumable init: missing Location header in response"
                )

        # Stream: source GET → YouTube PUT. Both open at once so bytes
        # flow without buffering on disk or in memory.
        put_headers = {"Content-Type": "video/*"}
        if content_length:
            put_headers["Content-Length"] = str(content_length)

        with httpx.Client(timeout=RESUMABLE_STREAM_TIMEOUT, follow_redirects=True) as src_client:
            with src_client.stream("GET", source_url) as src_resp:
                if not src_resp.is_success:
                    raise PublisherError(
                        f"YouTube: could not fetch source video: HTTP {src_resp.status_code}"
                    )
                with httpx.Client(timeout=RESUMABLE_STREAM_TIMEOUT) as upload_client:
                    put = upload_client.put(
                        upload_url,
                        content=src_resp.iter_bytes(),
                        headers=put_headers,
                    )

        if put.status_code in (308,):
            # Resume Incomplete — we don't retry with Content-Range today.
            raise PublisherError(
                "YouTube resumable upload returned 308 Resume Incomplete — "
                "session was partial; the task will retry from the start."
            )
        if not put.is_success:
            logger.error(
                "YouTube resumable PUT failed: %s %s", put.status_code, put.text[:300]
            )
            raise PublisherError(
                f"YouTube resumable upload: HTTP {put.status_code}: {put.text[:200]}"
            )
        return put.json()

    def fetch_metrics(self, post: SocialPost, account: SocialAccount) -> MetricsResult:
        if not post.platform_post_id:
            return MetricsResult()
        token = resolve_token(account)

        with httpx.Client(base_url=API_ROOT, timeout=30.0) as client:
            r = client.get(
                "/youtube/v3/videos",
                params={"part": "statistics", "id": post.platform_post_id},
                headers={"Authorization": f"Bearer {token}"},
            )
            if not r.is_success:
                logger.warning("YouTube metrics failed: %s", r.text[:200])
                return MetricsResult()
            items = r.json().get("items", [])

        if not items:
            return MetricsResult()
        stats = items[0].get("statistics", {})

        return MetricsResult(
            likes=int(stats.get("likeCount") or 0),
            comments=int(stats.get("commentCount") or 0),
            shares=0,  # YouTube doesn't expose share count via Data API
            impressions=int(stats.get("viewCount") or 0),
            reach=int(stats.get("viewCount") or 0),
            raw_response=stats,
        )
