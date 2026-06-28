"""Auth endpoints — register, login, refresh, me."""
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.deps import get_current_user, get_db_with_rls_dep
from app.auth.passwords import hash_password, verify_password
from app.auth.tokens import create_access_token, create_refresh_token, decode_token
from app.core.rate_limit import limiter
from app.db.database import get_db
from app.models import Organization, User, UserRole
from app.schemas.auth import (
    LoginRequest,
    MeResponse,
    RefreshRequest,
    RegisterRequest,
    TokenResponse,
    UserResponse,
)

router = APIRouter(prefix="/auth", tags=["auth"])


def _build_token_payload(user: User) -> dict:
    """Build JWT payload from a User ORM instance."""
    return {
        "sub": str(user.id),
        "org_id": str(user.org_id),
        "role": user.role,
        "email": user.email,
    }


# ── Register (creates org + owner) ───────────────────────

# MED-2: cap registration to 5/hour per IP. New-org signup is rare; this
# kills the ability to scrape e-mail-enumeration responses or spam orgs.
@router.post("/register", response_model=TokenResponse, status_code=201)
@limiter.limit("5/hour")
async def register(
    request: Request,
    body: RegisterRequest,
    db: AsyncSession = Depends(get_db),
):
    """Register a new organization with the first owner user.

    This is the entry point for new customers. Creates:
      1. A new Organization
      2. A User with role=owner linked to that org

    The user's password is stored as a bcrypt hash in the
    dedicated ``password_hash`` column. ``auth_id`` is reserved
    for the external auth provider's user ID (e.g. Supabase
    auth.users.id) and must never hold a password hash.
    """
    # Check slug uniqueness
    existing_org = await db.execute(
        select(Organization).where(Organization.slug == body.org_slug)
    )
    if existing_org.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Organization slug already taken",
        )

    # Check email uniqueness
    existing_user = await db.execute(
        select(User).where(User.email == body.email)
    )
    if existing_user.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )

    # Create org
    org = Organization(
        name=body.org_name,
        slug=body.org_slug,
    )
    db.add(org)
    await db.flush()  # Get org.id

    # Create owner user. password_hash holds the bcrypt hash; auth_id is
    # left Null here because this is a custom-JWT signup (no Supabase UID).
    user = User(
        org_id=org.id,
        email=body.email,
        full_name=body.full_name,
        role=UserRole.OWNER.value,
        password_hash=hash_password(body.password),
    )
    db.add(user)
    await db.flush()  # Get user.id

    # Issue tokens
    payload = _build_token_payload(user)
    return TokenResponse(
        access_token=create_access_token(payload),
        refresh_token=create_refresh_token(payload),
    )


# ── Login ─────────────────────────────────────────────────

# MED-2: 10 attempts per minute per IP blocks a credential-stuffing tool
# while still allowing a real user a handful of typo-retries. Use the
# dedicated limit here rather than the global default so auth stays strict
# even if someone relaxes the default later.
@router.post("/login", response_model=TokenResponse)
@limiter.limit("10/minute")
async def login(
    request: Request,
    body: LoginRequest,
    db: AsyncSession = Depends(get_db),
):
    """Authenticate with email + password, returns JWT pair."""
    result = await db.execute(
        select(User).where(User.email == body.email, User.is_active == True)
    )
    user = result.scalar_one_or_none()

    # Custom-JWT login requires a password_hash. Supabase-only users
    # (password_hash is Null) must authenticate via Supabase Auth instead.
    if not user or not user.password_hash:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if not verify_password(body.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    payload = _build_token_payload(user)
    return TokenResponse(
        access_token=create_access_token(payload),
        refresh_token=create_refresh_token(payload),
    )


# ── Refresh ───────────────────────────────────────────────

# MED-2: refresh is cheap but attackers can still grind refresh tokens
# looking for leaked ones. 30/min is comfortable for legitimate clients
# even after app suspend/resume cycles.
@router.post("/refresh", response_model=TokenResponse)
@limiter.limit("30/minute")
async def refresh(
    request: Request,
    body: RefreshRequest,
    db: AsyncSession = Depends(get_db),
):
    """Exchange a valid refresh token for a new access + refresh pair."""
    payload = decode_token(body.refresh_token)
    if payload is None or payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )

    user_id = payload.get("sub")
    result = await db.execute(
        select(User).where(User.id == user_id, User.is_active == True)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or deactivated",
        )

    new_payload = _build_token_payload(user)
    return TokenResponse(
        access_token=create_access_token(new_payload),
        refresh_token=create_refresh_token(new_payload),
    )


# ── Me ────────────────────────────────────────────────────

@router.get("/me", response_model=MeResponse)
async def me(
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    """Get current user profile + org info."""
    result = await db.execute(
        select(User).where(User.id == current_user["sub"])
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    org_result = await db.execute(
        select(Organization).where(Organization.id == user.org_id)
    )
    org = org_result.scalar_one()

    return MeResponse(
        user=UserResponse.model_validate(user),
        org_name=org.name,
        org_slug=org.slug,
    )
