"""Team management API — invite, manage roles, remove team members."""
import logging
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, EmailStr
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.deps import get_current_user, get_db_with_rls_dep
from app.auth.permissions import require_permission
from app.core.config import get_settings
from app.models.organization import Organization
from app.models.user import User, UserRole

logger = logging.getLogger(__name__)

# Public frontend origin — the Supabase invite link bounces the user
# back here via our ``/auth/callback`` route, which exchanges the code
# for a session and sends new hires to ``/admin/onboarding`` to finish
# setting up their password.
#
# URL-1: was hard-coded as "https://app.steviesocial.com" — now pulled
# from settings.frontend_url so dev/staging/prod each bounce invites to
# the right host, and we stop leaking the legacy `steviesocial.com`
# domain into auth-callback URLs.
def _frontend_url() -> str:
    return get_settings().frontend_url.rstrip("/")

router = APIRouter(prefix="/team", tags=["team"])


# ── Schemas ────────────────────────────────────────────────

class TeamMemberResponse(BaseModel):
    id: str
    email: str
    full_name: str
    role: str
    avatar_url: str | None = None
    is_active: bool
    created_at: datetime | None = None
    permissions: dict | None = None

    model_config = {"from_attributes": True}


class InviteRequest(BaseModel):
    email: EmailStr
    full_name: str
    role: str = "viewer"


class RoleUpdateRequest(BaseModel):
    role: str


class PermissionUpdateRequest(BaseModel):
    grants: list[str] = []
    revokes: list[str] = []


# ── Endpoints ──────────────────────────────────────────────

@router.get("", response_model=list[TeamMemberResponse])
async def list_team_members(
    include_inactive: bool = Query(False),
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(require_permission("team.view")),
):
    """List all team members in the organization."""
    query = select(User).order_by(User.full_name)
    if not include_inactive:
        query = query.where(User.is_active.is_(True))

    result = await db.execute(query)
    members = result.scalars().all()
    return [TeamMemberResponse.model_validate(m) for m in members]


@router.get("/me/permissions")
async def get_my_permissions(
    current_user: dict = Depends(get_current_user),
):
    """Get the current user's effective permissions."""
    from app.auth.permissions import get_all_permissions

    role = current_user.get("role", "viewer")
    user_perms = current_user.get("permissions")
    effective = get_all_permissions(role, user_perms)

    return {
        "role": role,
        "permissions": sorted(effective),
    }


@router.post("/invite", response_model=TeamMemberResponse, status_code=201)
async def invite_team_member(
    body: InviteRequest,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(require_permission("team.invite")),
):
    """Invite a new team member to the organization."""
    org_id = uuid.UUID(current_user["org_id"])

    # Validate role
    valid_roles = {r.value for r in UserRole if r != UserRole.CLIENT}
    if body.role not in valid_roles:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid role. Must be one of: {', '.join(sorted(valid_roles))}",
        )

    # Only owners can invite admins/owners
    inviter_role = current_user.get("role", "viewer")
    if body.role in ("owner", "admin") and inviter_role != "owner":
        raise HTTPException(
            status_code=403,
            detail="Only owners can invite admin or owner roles",
        )

    # Check if user already exists in org
    existing = await db.execute(
        select(User).where(
            User.org_id == org_id,
            User.email == body.email,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=409,
            detail="User already exists in this organization",
        )

    # Lookup org name for the branded email (fallback to "Stevie Social"
    # if the row somehow doesn't exist — shouldn't happen because the
    # inviter's JWT carries a valid org_id).
    org_row = (await db.execute(
        select(Organization).where(Organization.id == org_id)
    )).scalar_one_or_none()
    org_name = org_row.name if org_row and org_row.name else "Stevie Social"

    inviter_name = (
        current_user.get("full_name")
        or current_user.get("email")
        or "A teammate"
    )

    # ── Supabase invite (preferred) ──────────────────────────────
    # generate_link with type=invite:
    #   • creates the auth.users row (or finds it if the email already
    #     exists in Supabase auth but not in our org)
    #   • returns a signed, one-time action_link the user clicks
    #   • lets us embed org_id + role in app_metadata so the JWT issued
    #     after signup already has the right claims
    # Supabase's own email is suppressed — we deliver the branded Resend
    # email with the returned action_link.
    settings = get_settings()
    supabase_user_id: str | None = None
    action_link: str | None = None

    if settings.supabase_configured and settings.supabase_service_role_key:
        from app.auth.supabase import (
            generate_supabase_invite_link,
            update_supabase_app_metadata,
        )

        invite = await generate_supabase_invite_link(
            email=body.email,
            redirect_to=f"{_frontend_url()}/auth/callback?type=invite",
            user_metadata={"full_name": body.full_name},
            app_metadata={
                "org_id": str(org_id),
                "role": body.role,
            },
        )
        if invite:
            supabase_user_id = invite["user_id"]
            action_link = invite["action_link"]
            # Belt-and-suspenders on the app_metadata — generate_link
            # accepts it in some Supabase versions but not older
            # self-hosted ones, so always re-assert it with a
            # dedicated admin PUT.
            try:
                await update_supabase_app_metadata(
                    supabase_user_id,
                    {"org_id": str(org_id), "role": body.role},
                )
            except Exception:  # noqa: BLE001 — non-fatal
                logger.warning(
                    "Failed to set app_metadata for %s; claims may be missing",
                    body.email,
                )
        else:
            logger.warning(
                "Supabase invite generation failed for %s — falling back",
                body.email,
            )

    # Create the user record (linked to Supabase auth.users via auth_id
    # when the invite flow succeeded; unlinked fallback otherwise — the
    # admin can re-send later once Supabase is reachable)
    new_user = User(
        org_id=org_id,
        email=body.email,
        full_name=body.full_name,
        role=body.role,
        is_active=True,
        auth_id=supabase_user_id,
    )
    db.add(new_user)
    await db.flush()
    await db.refresh(new_user)

    # ── Send the branded Resend email ────────────────────────────
    # Only fire when we have a real action_link — otherwise the email
    # has nothing to point at and would just confuse the recipient.
    if action_link:
        try:
            from app.services.team_invites import queue_invite_email

            await queue_invite_email(
                to_email=body.email,
                full_name=body.full_name,
                org_name=org_name,
                inviter_name=inviter_name,
                role=body.role,
                action_link=action_link,
                org_id=str(org_id),
            )
        except Exception:  # noqa: BLE001 — never block the invite on email
            logger.exception(
                "Invite created but branded email queue failed for %s",
                body.email,
            )

    return TeamMemberResponse.model_validate(new_user)


@router.post("/{user_id}/resend-invite", response_model=TeamMemberResponse)
async def resend_invite(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(require_permission("team.invite")),
):
    """Regenerate a fresh Supabase invite link and re-send the branded email.

    Idempotent — calling twice just issues a new one-time link. Useful
    when the original expires before the invitee clicks, or when the
    first email ended up in spam.
    """
    org_id = uuid.UUID(current_user["org_id"])
    settings = get_settings()

    result = await db.execute(
        select(User).where(User.id == user_id, User.org_id == org_id)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if not user.is_active:
        raise HTTPException(
            status_code=400,
            detail="User is deactivated — reactivate before re-sending an invite.",
        )

    if not (settings.supabase_configured and settings.supabase_service_role_key):
        raise HTTPException(
            status_code=503,
            detail="Supabase invite flow is not configured on this server.",
        )

    from app.auth.supabase import (
        generate_supabase_invite_link,
        update_supabase_app_metadata,
    )

    invite = await generate_supabase_invite_link(
        email=user.email,
        redirect_to=f"{_frontend_url()}/auth/callback?type=invite",
        user_metadata={"full_name": user.full_name},
        app_metadata={"org_id": str(org_id), "role": user.role},
    )
    if not invite:
        raise HTTPException(
            status_code=502,
            detail="Supabase invite generation failed. Try again in a moment.",
        )

    # Backfill auth_id if it was missing from the first try
    if not user.auth_id:
        user.auth_id = invite["user_id"]
        user.version += 1
        await db.flush()
        await db.refresh(user)

    try:
        await update_supabase_app_metadata(
            invite["user_id"],
            {"org_id": str(org_id), "role": user.role},
        )
    except Exception:  # noqa: BLE001
        logger.warning("app_metadata re-assert failed for %s", user.email)

    org_row = (await db.execute(
        select(Organization).where(Organization.id == org_id)
    )).scalar_one_or_none()
    org_name = org_row.name if org_row and org_row.name else "Stevie Social"
    inviter_name = (
        current_user.get("full_name") or current_user.get("email") or "A teammate"
    )

    try:
        from app.services.team_invites import queue_invite_email

        await queue_invite_email(
            to_email=user.email,
            full_name=user.full_name,
            org_name=org_name,
            inviter_name=inviter_name,
            role=user.role,
            action_link=invite["action_link"],
            org_id=str(org_id),
        )
    except Exception:  # noqa: BLE001
        logger.exception("Re-send invite email queue failed for %s", user.email)

    return TeamMemberResponse.model_validate(user)


@router.patch("/{user_id}/role", response_model=TeamMemberResponse)
async def update_member_role(
    user_id: uuid.UUID,
    body: RoleUpdateRequest,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(require_permission("team.manage")),
):
    """Update a team member's role."""
    org_id = uuid.UUID(current_user["org_id"])

    valid_roles = {r.value for r in UserRole if r != UserRole.CLIENT}
    if body.role not in valid_roles:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid role. Must be one of: {', '.join(sorted(valid_roles))}",
        )

    # Can't change your own role
    if str(user_id) == current_user.get("sub"):
        raise HTTPException(status_code=400, detail="Cannot change your own role")

    # Only owners can set admin/owner roles
    inviter_role = current_user.get("role", "viewer")
    if body.role in ("owner", "admin") and inviter_role != "owner":
        raise HTTPException(
            status_code=403, detail="Only owners can assign admin or owner roles"
        )

    # Belt-and-suspenders: RLS will already filter, but never rely on a
    # single layer for a privilege-affecting mutation.
    result = await db.execute(
        select(User).where(User.id == user_id, User.org_id == org_id)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Can't demote another owner unless you're an owner
    if user.role == "owner" and inviter_role != "owner":
        raise HTTPException(status_code=403, detail="Only owners can modify owner accounts")

    user.role = body.role
    user.version += 1
    await db.flush()
    await db.refresh(user)
    return TeamMemberResponse.model_validate(user)


@router.patch("/{user_id}/permissions", response_model=TeamMemberResponse)
async def update_member_permissions(
    user_id: uuid.UUID,
    body: PermissionUpdateRequest,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(require_permission("team.manage")),
):
    """Update a team member's per-user permission overrides."""
    org_id = uuid.UUID(current_user["org_id"])
    result = await db.execute(
        select(User).where(User.id == user_id, User.org_id == org_id)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.permissions = {
        "grants": body.grants,
        "revokes": body.revokes,
    }
    user.version += 1
    await db.flush()
    await db.refresh(user)
    return TeamMemberResponse.model_validate(user)


@router.post("/{user_id}/deactivate", response_model=TeamMemberResponse)
async def deactivate_member(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(require_permission("team.remove")),
):
    """Deactivate a team member (soft delete)."""
    if str(user_id) == current_user.get("sub"):
        raise HTTPException(status_code=400, detail="Cannot deactivate yourself")

    org_id = uuid.UUID(current_user["org_id"])
    result = await db.execute(
        select(User).where(User.id == user_id, User.org_id == org_id)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Can't deactivate another owner unless you're an owner
    if user.role == "owner" and current_user.get("role") != "owner":
        raise HTTPException(status_code=403, detail="Only owners can deactivate owners")

    user.is_active = False
    user.version += 1
    await db.flush()
    await db.refresh(user)
    return TeamMemberResponse.model_validate(user)


@router.post("/{user_id}/reactivate", response_model=TeamMemberResponse)
async def reactivate_member(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(require_permission("team.manage")),
):
    """Reactivate a previously deactivated team member."""
    org_id = uuid.UUID(current_user["org_id"])
    result = await db.execute(
        select(User).where(User.id == user_id, User.org_id == org_id)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.is_active = True
    user.version += 1
    await db.flush()
    await db.refresh(user)
    return TeamMemberResponse.model_validate(user)
