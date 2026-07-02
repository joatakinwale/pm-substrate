from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from app.api.internal import social as internal_social
from app.api.internal.social import (
    ScheduledPostItem,
    SocialPublishBody,
    publish_post_from_worker,
)
from app.models.social_media import SocialPost


HASH_A = "a" * 64


def test_social_publish_body_requires_expected_content_hash():
    with pytest.raises(ValidationError):
        SocialPublishBody(org_id=uuid.uuid4())


def test_social_publish_body_rejects_invalid_expected_content_hash():
    with pytest.raises(ValidationError):
        SocialPublishBody(
            org_id=uuid.uuid4(),
            expected_content_hash="not-a-sha256",
        )


def test_scheduled_sweep_item_carries_expected_content_hash():
    item = ScheduledPostItem(
        post_id=uuid.uuid4(),
        org_id=uuid.uuid4(),
        expected_content_hash=HASH_A,
    )

    assert item.expected_content_hash == HASH_A


def test_scheduled_sweep_body_defaults_to_stale_publishing_retry_window():
    body = internal_social.ScheduledSweepBody()

    assert body.retry_stale_publishing_after_minutes == 30


def test_publish_sweep_candidate_includes_due_and_stale_publishing_posts():
    now = datetime(2026, 7, 1, 12, 0, tzinfo=timezone.utc)
    stale_before = now - timedelta(minutes=30)
    due = SocialPost(
        status="scheduled",
        scheduled_at=now - timedelta(minutes=1),
        updated_at=now,
    )
    stale_publishing = SocialPost(
        status="publishing",
        scheduled_at=now - timedelta(hours=1),
        updated_at=stale_before - timedelta(seconds=1),
    )
    fresh_publishing = SocialPost(
        status="publishing",
        scheduled_at=now - timedelta(hours=1),
        updated_at=stale_before + timedelta(seconds=1),
    )

    assert internal_social._is_publish_sweep_candidate(
        due,
        now=now,
        stale_publishing_before=stale_before,
    )
    assert internal_social._is_publish_sweep_candidate(
        stale_publishing,
        now=now,
        stale_publishing_before=stale_before,
    )
    assert not internal_social._is_publish_sweep_candidate(
        fresh_publishing,
        now=now,
        stale_publishing_before=stale_before,
    )


@pytest.mark.asyncio
async def test_publish_route_maps_content_hash_mismatch_to_409(monkeypatch):
    def fake_publish_post_sync(**_kwargs):
        return {
            "error": "content_hash_mismatch",
            "detail": "Social post content hash mismatch",
        }

    monkeypatch.setattr(
        internal_social,
        "_publish_post_sync",
        fake_publish_post_sync,
    )

    with pytest.raises(HTTPException) as exc:
        await publish_post_from_worker(
            post_id=uuid.uuid4(),
            body=SocialPublishBody(
                org_id=uuid.uuid4(),
                expected_content_hash=HASH_A,
            ),
            _=None,
        )

    assert exc.value.status_code == 409
    assert "content hash" in str(exc.value.detail).lower()


class _FakeSyncSession:
    def __init__(self, post: SocialPost):
        self.post = post
        self.commits = 0

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False

    def execute(self, *_args, **_kwargs):
        return None

    def get(self, model, item_id):
        if model is SocialPost and item_id == self.post.id:
            return self.post
        return None

    def commit(self):
        self.commits += 1


def test_publish_sync_rejects_scheduled_content_hash_mismatch(monkeypatch):
    org_id = uuid.uuid4()
    post = SocialPost(
        id=uuid.uuid4(),
        org_id=org_id,
        social_account_id=uuid.uuid4(),
        platform="linkedin",
        status="publishing",
        caption="Changed after scheduling",
        hashtags=["launch"],
        media_urls=["r2://media/changed.png"],
        media_type="image",
        scheduled_content_hash=HASH_A,
    )
    fake_session = _FakeSyncSession(post)
    monkeypatch.setattr(
        internal_social,
        "Session",
        lambda _engine: fake_session,
    )

    result = internal_social._publish_post_sync(
        post_id=post.id,
        org_id=org_id,
        expected_content_hash=HASH_A,
    )

    assert result["error"] == "content_hash_mismatch"
    assert post.status == "failed"
    assert "content hash" in post.error_message.lower()
    assert fake_session.commits == 1
