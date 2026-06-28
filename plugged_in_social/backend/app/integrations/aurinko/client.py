"""Aurinko HTTP client.

Two auth modes share one transport:

  * ``app_request`` — Basic-auth with ``clientId:clientSecret``. Used
    for the OAuth handshake, application-scoped booking-profile CRUD,
    and any availability query that doesn't run against a single user
    account.
  * ``account_request`` — Bearer-auth with a per-user account access
    token. Used for everything calendar / contacts / mailbox.

Both surface the same ``AurinkoError`` on non-2xx so callers don't have
to special-case status codes. Connection pooling is shared via a
module-level ``httpx.AsyncClient`` matching the pattern in
``app.services.realtime``.
"""
from __future__ import annotations

import base64
import logging
from typing import Any

import httpx

from app.core.config import get_settings

logger = logging.getLogger(__name__)


class AurinkoError(RuntimeError):
    """Raised when Aurinko returns a non-2xx response."""

    def __init__(self, status_code: int, message: str, body: Any = None) -> None:
        super().__init__(f"Aurinko {status_code}: {message}")
        self.status_code = status_code
        self.body = body


class AurinkoNotConfiguredError(RuntimeError):
    """Raised when Aurinko credentials are missing.

    Surfaced as a 503 by the route layer so the operator notices the
    gap immediately rather than seeing OAuth fail mid-flow.
    """


_client: httpx.AsyncClient | None = None


def _get_client() -> httpx.AsyncClient:
    global _client
    if _client is None:
        _client = httpx.AsyncClient(timeout=httpx.Timeout(20.0, connect=5.0))
    return _client


def _basic_auth_header() -> str:
    settings = get_settings()
    if not settings.aurinko_configured:
        raise AurinkoNotConfiguredError(
            "Aurinko is not configured. Set AURINKO_CLIENT_ID, "
            "AURINKO_CLIENT_SECRET, and AURINKO_SIGNING_SECRET."
        )
    raw = f"{settings.aurinko_client_id}:{settings.aurinko_client_secret}".encode()
    return f"Basic {base64.b64encode(raw).decode()}"


def _base_url() -> str:
    return get_settings().aurinko_base_url.rstrip("/")


async def app_request(
    method: str,
    path: str,
    *,
    params: dict[str, Any] | None = None,
    json: Any = None,
    extra_headers: dict[str, str] | None = None,
) -> Any:
    """Make an app-scoped (Basic auth) request to Aurinko.

    ``path`` is appended to the configured ``aurinko_base_url`` and
    must start with ``/``. Returns parsed JSON on 2xx, raises
    ``AurinkoError`` otherwise.
    """
    headers = {
        "Authorization": _basic_auth_header(),
        "Accept": "application/json",
    }
    if json is not None:
        headers["Content-Type"] = "application/json"
    if extra_headers:
        headers.update(extra_headers)

    url = f"{_base_url()}{path}"
    resp = await _get_client().request(
        method, url, params=params, json=json, headers=headers
    )
    return _handle_response(resp)


async def account_request(
    method: str,
    path: str,
    *,
    access_token: str,
    params: dict[str, Any] | None = None,
    json: Any = None,
    extra_headers: dict[str, str] | None = None,
) -> Any:
    """Make a per-account (Bearer auth) request to Aurinko."""
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Accept": "application/json",
    }
    if json is not None:
        headers["Content-Type"] = "application/json"
    if extra_headers:
        headers.update(extra_headers)

    url = f"{_base_url()}{path}"
    resp = await _get_client().request(
        method, url, params=params, json=json, headers=headers
    )
    return _handle_response(resp)


def _handle_response(resp: httpx.Response) -> Any:
    if 200 <= resp.status_code < 300:
        if resp.status_code == 204 or not resp.content:
            return None
        try:
            return resp.json()
        except ValueError:
            return resp.text
    body: Any
    try:
        body = resp.json()
        message = (
            body.get("message")
            if isinstance(body, dict)
            else None
        ) or resp.text
    except ValueError:
        body = resp.text
        message = body or "no response body"
    logger.warning(
        "aurinko_request_failed status=%s url=%s message=%s",
        resp.status_code,
        resp.request.url,
        message,
    )
    raise AurinkoError(resp.status_code, message, body)
