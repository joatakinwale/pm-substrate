"""Fine-grained permission system for Stevie Social.

Combines role-based access control (RBAC) with per-feature permissions.

Role hierarchy (most → least privileged):
  owner > admin > editor > viewer > client

Each role inherits all permissions from lower roles plus its own.

Usage in routes:

    from app.auth.permissions import require_permission

    @router.post("/leads")
    async def create_lead(
        current_user: dict = Depends(require_permission("leads.create")),
    ):
        ...

    @router.delete("/projects/{id}")
    async def delete_project(
        current_user: dict = Depends(require_permission("projects.delete")),
    ):
        ...

Permission naming: "{module}.{action}"
  Modules: leads, contacts, projects, proposals, email, social, forms,
           automations, billing, analytics, settings, team, video, ai_content
  Actions: view, create, edit, delete, manage, export
"""

from collections.abc import Callable

from fastapi import Depends, HTTPException, status

from app.auth.deps import get_current_user

# ── Role → Permission Matrix ──────────────────────────────

ROLE_PERMISSIONS: dict[str, set[str]] = {
    "owner": {
        # Everything admin has, plus:
        "billing.manage",
        "team.manage",
        "team.invite",
        "team.remove",
        "settings.manage",
        "settings.delete_org",
        "analytics.export",
        "api_keys.manage",
    },
    "admin": {
        # Everything editor has, plus:
        "leads.delete",
        "contacts.delete",
        "contacts.import",
        "contacts.export",
        "projects.delete",
        "proposals.delete",
        "email.delete",
        "email.manage_templates",
        "social.delete",
        "forms.delete",
        "automations.delete",
        "automations.activate",
        "video.delete",
        "ai_content.manage",
        "settings.view",
        "settings.edit",
        "team.view",
        "billing.view",
        "analytics.view_all",
    },
    "editor": {
        # Everything viewer has, plus:
        "leads.create",
        "leads.edit",
        "contacts.create",
        "contacts.edit",
        "projects.create",
        "projects.edit",
        "projects.manage_tasks",
        "proposals.create",
        "proposals.edit",
        "proposals.send",
        "email.create",
        "email.edit",
        "email.send",
        "social.create",
        "social.edit",
        "social.schedule",
        "forms.create",
        "forms.edit",
        "automations.create",
        "automations.edit",
        "video.create",
        "video.edit",
        "video.upload",
        "ai_content.create",
        "ai_content.edit",
        "analytics.view",
    },
    "viewer": {
        "leads.view",
        "contacts.view",
        "projects.view",
        "proposals.view",
        "email.view",
        "social.view",
        "forms.view",
        "automations.view",
        "video.view",
        "ai_content.view",
        "analytics.view",
    },
    "client": {
        # Portal-only access (handled separately via portal auth)
        "portal.view",
        "portal.approve",
        "portal.comment",
    },
}

# Build cumulative permissions (each role includes all lower role perms)
_HIERARCHY = ["client", "viewer", "editor", "admin", "owner"]


def _build_cumulative_permissions() -> dict[str, set[str]]:
    """Build the full permission set for each role including inherited."""
    cumulative: dict[str, set[str]] = {}
    accumulated: set[str] = set()
    for role in _HIERARCHY:
        accumulated = accumulated | ROLE_PERMISSIONS.get(role, set())
        cumulative[role] = set(accumulated)
    return cumulative


EFFECTIVE_PERMISSIONS = _build_cumulative_permissions()


def has_permission(role: str, permission: str, user_permissions: dict | None = None) -> bool:
    """Check if a role has a specific permission.

    Also checks user-level permission overrides:
      - user.permissions = {"grants": ["video.upload"], "revokes": ["email.send"]}
    """
    # Check user-level overrides first
    if user_permissions:
        if permission in user_permissions.get("revokes", []):
            return False
        if permission in user_permissions.get("grants", []):
            return True

    role_perms = EFFECTIVE_PERMISSIONS.get(role, set())
    return permission in role_perms


def get_all_permissions(role: str, user_permissions: dict | None = None) -> set[str]:
    """Get all effective permissions for a role + user overrides."""
    perms = set(EFFECTIVE_PERMISSIONS.get(role, set()))

    if user_permissions:
        perms |= set(user_permissions.get("grants", []))
        perms -= set(user_permissions.get("revokes", []))

    return perms


# ── FastAPI Dependencies ──────────────────────────────────

def require_permission(permission: str) -> Callable:
    """FastAPI dependency that checks for a specific permission.

    Usage:
        @router.post("/leads")
        async def create_lead(
            current_user: dict = Depends(require_permission("leads.create")),
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
        user_perms = current_user.get("permissions")

        if not has_permission(role, permission, user_perms):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission '{permission}' required. Your role '{role}' does not have this permission.",
            )
        return current_user
    return _check


def require_any_permission(*permissions: str) -> Callable:
    """FastAPI dependency that checks for ANY of the listed permissions."""
    async def _check(
        current_user: dict = Depends(get_current_user),
    ) -> dict:
        if current_user.get("_needs_resolution"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User account not yet provisioned",
            )

        role = current_user.get("role", "viewer")
        user_perms = current_user.get("permissions")

        for perm in permissions:
            if has_permission(role, perm, user_perms):
                return current_user

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"One of these permissions required: {', '.join(permissions)}",
        )
    return _check
