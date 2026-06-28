"""FastAPI auth dependencies — extract user from JWT, inject RLS context.

Supports two auth modes:
  1. Supabase Auth (production) — validates Supabase-issued JWTs
  2. Custom JWT (dev/testing) — validates self-issued JWTs

The mode is determined by whether SUPABASE_JWT_SECRET is configured.
When both are available, Supabase is tried first.

Usage in routes:

    @router.get("/leads")
    async def list_leads(
        db: AsyncSession = Depends(get_db_with_rls_dep),
        current_user: dict = Depends(get_current_user),
    ):
        ...

    @router.post("/pages")
    async def create_page(
        db: AsyncSession = Depends(get_db_with_rls_dep),
        current_user: dict = Depends(require_role(["admin", "owner", "editor"])),
    ):
        ...
"""
import logging
from collections.abc import AsyncGenerator, Callable

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.supabase import decode_supabase_token, extract_user_info
from app.auth.tokens import decode_token
from app.core.config import get_settings
from app.db.database import RequestContext, get_db, get_db_with_rls

logger = logging.getLogger(__name__)

# Bearer token scheme — expects "Authorization: Bearer <token>"
bearer_scheme = HTTPBearer(auto_error=True)


async def _resolve_supabase_user(
    payload: dict, db: AsyncSession
) -> dict:
    """Resolve a Supabase JWT payload into our internal user claims.

    On first login, creates a User record linked to Supabase's auth.users.id.
    On subsequent logins, looks up the existing User by auth_id.

    Returns a dict compatible with our internal JWT claims:
      - sub: our User.id (UUID string)
      - org_id: organization UUID string
      - role: user role string
      - email: user email
    """
    from app.auth.supabase import update_supabase_app_metadata
    from app.models import Organization, User

    user_info = extract_user_info(payload)
    supabase_uid = user_info["supabase_user_id"]

    # Look up existing user by Supabase auth ID
    result = await db.execute(
        select(User).where(User.auth_id == supabase_uid, User.is_active == True)
    )
    user = result.scalar_one_or_none()

    if user:
        return {
            "sub": str(user.id),
            "org_id": str(user.org_id),
            "role": user.role,
            "email": user.email,
        }

    # First login — check if app_metadata has org_id (set during invite flow)
    if user_info.get("org_id"):
        # User was invited to an existing org
        result = await db.execute(
            select(Organization).where(
                Organization.id == user_info["org_id"],
                Organization.is_active == True,
            )
        )
        org = result.scalar_one_or_none()
        if not org:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Organization not found",
            )
        new_user = User(
            org_id=org.id,
            auth_id=supabase_uid,
            email=user_info["email"],
            full_name=user_info["full_name"],
            avatar_url=user_info.get("avatar_url"),
            role=user_info.get("role", "viewer"),
        )
    else:
        # Brand new signup — create org + owner
        org_slug = user_info["email"].split("@")[0].lower().replace(".", "-")
        org_name = user_info["full_name"] + "'s Organization"

        # Ensure slug is unique by appending a suffix if needed
        base_slug = org_slug
        counter = 1
        while True:
            result = await db.execute(
                select(Organization).where(Organization.slug == org_slug)
            )
            if not result.scalar_one_or_none():
                break
            org_slug = f"{base_slug}-{counter}"
            counter += 1

        org = Organization(name=org_name, slug=org_slug)
        db.add(org)
        await db.flush()

        new_user = User(
            org_id=org.id,
            auth_id=supabase_uid,
            email=user_info["email"],
            full_name=user_info["full_name"],
            avatar_url=user_info.get("avatar_url"),
            role="owner",
        )

    db.add(new_user)
    await db.flush()

    # Persist org_id and role in Supabase app_metadata so future JWTs include them
    try:
        await update_supabase_app_metadata(
            supabase_uid,
            {"org_id": str(new_user.org_id), "role": new_user.role},
        )
    except Exception:
        logger.warning(
            "Failed to update Supabase app_metadata for user %s",
            supabase_uid,
        )

    await db.commit()

    return {
        "sub": str(new_user.id),
        "org_id": str(new_user.org_id),
        "role": new_user.role,
        "email": new_user.email,
    }


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> dict:
    """Extract and validate the current user from the JWT.

    Tries Supabase JWT first (if configured), falls back to custom JWT.

    Returns a dict with:
      - sub (user_id)
      - org_id
      - role
      - email (if present)
    """
    token = credentials.credentials
    settings = get_settings()

    # ── Try Supabase JWT ──
    if settings.supabase_jwt_secret:
        supabase_payload = decode_supabase_token(token)
        if supabase_payload:
            # For Supabase tokens, we need a DB session to resolve/create the user
            # Check if app_metadata already has our claims
            app_metadata = supabase_payload.get("app_metadata", {})
            if app_metadata.get("org_id") and app_metadata.get("stevie_user_id"):
                # Fast path — claims already in JWT
                return {
                    "sub": app_metadata["stevie_user_id"],
                    "org_id": app_metadata["org_id"],
                    "role": app_metadata.get("role", "viewer"),
                    "email": supabase_payload.get("email", ""),
                }
            # Slow path — need DB lookup (handled in get_db_with_rls_dep)
            return {
                "_supabase_payload": supabase_payload,
                "_needs_resolution": True,
                "email": supabase_payload.get("email", ""),
            }

    # ── Try custom JWT ──
    payload = decode_token(token)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type — expected access token",
        )
    if not payload.get("sub") or not payload.get("org_id"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing required claims",
        )
    return payload


async def get_db_with_rls_dep(
    current_user: dict = Depends(get_current_user),
) -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency that yields a DB session with RLS context set.

    If the user came via a Supabase JWT that needs resolution (first login),
    resolves the user first, then sets RLS context.
    """
    # Handle Supabase tokens that need DB resolution
    if current_user.get("_needs_resolution"):
        async for db in get_db():
            resolved = await _resolve_supabase_user(
                current_user["_supabase_payload"], db
            )
            # Update current_user in place so downstream deps see resolved claims
            current_user.clear()
            current_user.update(resolved)
            break

    ctx = RequestContext(
        org_id=current_user["org_id"],
        user_id=current_user["sub"],
        role=current_user.get("role", "viewer"),
    )
    async for session in get_db_with_rls(ctx):
        yield session


def require_role(allowed_roles: list[str]) -> Callable:
    """Dependency factory — restricts access to specific roles.

    Usage:
        @router.delete("/pages/{id}")
        async def delete_page(
            current_user: dict = Depends(require_role(["admin", "owner"])),
        ):
            ...
    """
    async def _check(
        current_user: dict = Depends(get_current_user),
    ) -> dict:
        if current_user.get("_needs_resolution"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User account not yet provisioned",
            )
        role = current_user.get("role", "viewer")
        if role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{role}' is not authorized for this action",
            )
        return current_user
    return _check
