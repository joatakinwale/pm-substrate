"""Aurinko OAuth — authorize-URL builder + token exchange + revoke.

End-to-end flow:

1. Browser hits ``GET /api/integrations/aurinko/authorize`` on our
   backend, which calls ``build_authorize_url`` and 302-redirects.
2. User consents on Google/Microsoft/etc. Aurinko redirects to the
   ``returnUrl`` we registered with ``code`` + ``state``.
3. Backend ``GET /api/integrations/aurinko/callback`` receives that
   redirect and calls ``exchange_code`` to get the
   ``accountAccessToken``.
4. We persist that token (encrypted) in the ``integration_accounts``
   row keyed by org.
"""
from __future__ import annotations

import logging
import urllib.parse
from typing import Literal

from app.core.config import get_settings

from .client import AurinkoNotConfiguredError, app_request

logger = logging.getLogger(__name__)

ServiceType = Literal["Google", "Office365", "iCloud", "MSLive"]

# Scopes needed to power booking + calendar sync + contacts sync.
# Aurinko docs: https://docs.aurinko.io/authentication/oauth-flow
DEFAULT_SCOPES: tuple[str, ...] = (
    "Calendar.ReadWrite",
    "Contacts.ReadWrite",
)


def build_authorize_url(
    *,
    service_type: ServiceType,
    return_url: str,
    state: str,
    scopes: tuple[str, ...] = DEFAULT_SCOPES,
    response_type: str = "code",
) -> str:
    """Build the Aurinko OAuth authorize URL.

    Aurinko expects the application's clientId, the provider service
    type, the requested scopes (space-separated), and a returnUrl that
    must already be registered on the application. ``state`` is opaque
    to Aurinko and round-tripped back to the callback unchanged — use
    it to carry a signed (org_id, user_id, return_to) bundle.
    """
    settings = get_settings()
    if not settings.aurinko_configured:
        raise AurinkoNotConfiguredError(
            "Aurinko is not configured — refusing to build authorize URL."
        )

    params = {
        "clientId": settings.aurinko_client_id,
        "serviceType": service_type,
        "scopes": " ".join(scopes),
        "responseType": response_type,
        "returnUrl": return_url,
        "state": state,
    }
    base = settings.aurinko_base_url.rstrip("/")
    return f"{base}/auth/authorize?{urllib.parse.urlencode(params)}"


async def exchange_code(code: str) -> dict:
    """Exchange a one-time ``code`` for an account access token.

    Returns the full Aurinko response which contains at least
    ``accountId`` and ``accessToken``. Aurinko refreshes tokens
    transparently on its own side; the access token we receive here
    can be used until the user revokes the connection.
    """
    return await app_request("POST", f"/auth/token/{code}")


async def revoke_account(*, account_id: int, access_token: str) -> None:
    """Revoke the Aurinko account on the user's behalf.

    Best-effort: we still want to delete the local row even if Aurinko
    is unreachable, so the caller should swallow exceptions and log.
    """
    from .client import account_request

    await account_request(
        "DELETE",
        f"/account/{account_id}",
        access_token=access_token,
    )
