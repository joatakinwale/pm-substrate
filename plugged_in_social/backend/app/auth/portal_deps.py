"""Portal auth dependencies — validates client portal sessions.

Client portal auth is separate from admin Supabase auth.
Clients authenticate via magic-link tokens which create PortalSession records.
The session_token is passed as an HttpOnly cookie (preferred, FE-25) or as a
Bearer token (legacy; accepted during migration).

Portal sessions are scoped to:
  - org_id: the agency's organization
  - client_email: the client's email address
  - project_id: optionally, a specific project

All portal queries filter by org_id + client_email to ensure
clients can only see their own data.
"""
import logging
from collections.abc import AsyncGenerator
from datetime import datetime, timezone

from fastapi import Cookie, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db, get_db_with_rls, RequestContext
from app.models.portal import PortalSession

logger = logging.getLogger(__name__)

# FE-25: auto_error=False so the dependency doesn't raise 401 when the
# Authorization header is missing — we need to also allow cookie auth.
# The manual check below produces a clearer error message than the
# generic "Not authenticated" HTTPBearer emits when bearer is absent.
portal_bearer = HTTPBearer(auto_error=False)

# FE-25: cookie name must match api/portal.py::PORTAL_COOKIE_NAME.
# Kept as a string literal here to avoid a circular import; tests pin
# both sides against this value.
_PORTAL_COOKIE_NAME = "stevie_portal_session"


async def get_portal_session(
    credentials: HTTPAuthorizationCredentials | None = Depends(portal_bearer),
    session_cookie: str | None = Cookie(default=None, alias=_PORTAL_COOKIE_NAME),
) -> dict:
    """Validate a portal session token and return client claims.

    FE-25: accepts either the HttpOnly cookie (preferred) or an
    Authorization: Bearer header (legacy). Cookie wins if both are present,
    because the migrated clients always send the cookie and the Bearer
    header is kept only for clients that haven't been refreshed yet.

    Returns a dict with:
      - org_id: the agency's org
      - client_email: the client's email
      - client_name: the client's name
      - project_id: optional project scope
      - session_id: the session UUID
    """
    if session_cookie:
        session_token = session_cookie
    elif credentials is not None:
        session_token = credentials.credentials
    else:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing portal session — please log in",
        )

    # Look up the session in DB (we need a raw session, no RLS)
    async for db in get_db():
        result = await db.execute(
            select(PortalSession).where(
                PortalSession.session_token == session_token,
                PortalSession.is_active == True,
            )
        )
        session = result.scalar_one_or_none()

        if not session:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired portal session",
            )

        now = datetime.now(timezone.utc)
        if session.expires_at < now:
            # Expire the session
            session.is_active = False
            await db.commit()
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Portal session has expired",
            )

        # Update last_active_at
        session.last_active_at = now
        await db.commit()

        return {
            "org_id": str(session.org_id),
            "client_email": session.client_email,
            "client_name": session.client_name,
            "project_id": str(session.project_id) if session.project_id else None,
            "session_id": str(session.id),
        }


async def get_portal_db(
    portal_client: dict = Depends(get_portal_session),
) -> AsyncGenerator[AsyncSession, None]:
    """Yield a DB session with RLS context set for the client's org.

    Uses the portal session's org_id to scope all queries.
    The role is set to 'client' — RLS policies can differentiate
    between admin and client access if needed.
    """
    ctx = RequestContext(
        org_id=portal_client["org_id"],
        user_id=portal_client["session_id"],  # Use session ID as user context
        role="client",
    )
    async for session in get_db_with_rls(ctx):
        yield session
