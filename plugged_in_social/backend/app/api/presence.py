"""Presence + concurrent-edit indicator endpoints.

These are NOT part of the internal Worker contract — they're hit directly
by the frontend on heartbeats and edit-mode transitions, so they go
through the normal user JWT auth (``get_current_user`` + RLS) rather than
``X-Webhook-Secret``.

Three tiny endpoints:

  POST /api/presence/heartbeat
      Frontend calls this every 30s while a tab is open. We broadcast a
      ``presence.online`` event the first time we hear from a user and
      after each heartbeat — the org's Durable Object keeps the live
      roster. Returns 204.

  POST /api/presence/offline
      Frontend calls this on tab unload (best-effort — ``navigator.sendBeacon``
      from the browser). We broadcast ``presence.offline`` so other
      tabs see the user disappear from the avatar stack within a few
      seconds rather than waiting for the heartbeat timeout. Returns 204.

  POST /api/presence/editing
      Body: ``{"entity_type": "page" | "proposal" | ..., "entity_id": uuid,
              "action": "started" | "stopped"}``.
      The frontend fires ``started`` on edit-mode entry and ``stopped`` on
      exit / save / navigation away. Other clients viewing the same entity
      see the "{name} is editing this" banner.

Why we don't write to the DB: presence + editing state is ephemeral and
should evaporate on disconnect. Putting it in Postgres would mean GC'ing
stale rows, write contention on every heartbeat, and a worse failure
mode (a crashed user 'is online' until cleanup runs). The Durable Object
already holds it correctly.
"""

from __future__ import annotations

import uuid
from typing import Annotated, Literal

from fastapi import APIRouter, Body, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.deps import get_current_user, get_db_with_rls_dep
from app.auth.supabase import decode_supabase_token, extract_user_info
from app.auth.tokens import decode_token
from app.models import User
from app.services.realtime import (
    broadcast_entity_editing,
    broadcast_user_offline,
    broadcast_user_online,
)


async def _current_user_from_beacon(
    request: Request,
    token: str | None = Query(default=None, description="Fallback for navigator.sendBeacon"),
) -> dict:
    """Like ``get_current_user`` but accepts the JWT via ``?token=`` too.

    ``navigator.sendBeacon`` can't set request headers, so the frontend
    falls back to a query-param token on tab-close (``offline``) and
    edit-mode-exit (``editing`` action="stopped") endpoints. Bearer auth
    on the standard endpoints is unchanged.
    """
    # Prefer Authorization header when present (matches every other endpoint).
    auth_header = request.headers.get("authorization") or ""
    if auth_header.lower().startswith("bearer "):
        token = auth_header.split(" ", 1)[1].strip()
    if not token:
        raise HTTPException(
            status_code=401,
            detail="Missing Bearer token (header or ?token=)",
        )

    # Try Supabase first (production), then custom JWT (dev fallback).
    supabase_payload = decode_supabase_token(token)
    if supabase_payload:
        info = extract_user_info(supabase_payload)
        app_metadata = supabase_payload.get("app_metadata", {})
        # Beacon path is read-mostly broadcast — we don't need full
        # resolve_supabase_user(); use whatever's in app_metadata or the
        # JWT info.
        return {
            "sub": app_metadata.get("stevie_user_id") or info["supabase_user_id"],
            "org_id": app_metadata.get("org_id") or info.get("org_id"),
            "role": app_metadata.get("role") or info.get("role", "viewer"),
            "email": info.get("email", ""),
        }

    payload = decode_token(token)
    if payload and payload.get("type") == "access":
        return payload

    raise HTTPException(status_code=401, detail="Invalid or expired token")

router = APIRouter(prefix="/presence", tags=["presence"])


async def _user_payload(
    db: AsyncSession, user_id: uuid.UUID
) -> dict:
    """Look up the public-facing fields the frontend needs to render an
    avatar. We pull these on every broadcast rather than caching client
    side — saves one round-trip when the avatar list is hydrated."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        return {}
    return {
        "full_name": user.full_name or user.email,
        "email": user.email,
        "avatar_url": user.avatar_url,
        "role": user.role,
    }


# ── Heartbeat (online) ────────────────────────────────────────────────


@router.post("/heartbeat", status_code=204)
async def heartbeat(
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
) -> None:
    """Frontend pings this every 30s while a tab is open.

    We re-broadcast on every tick so a fresh tab opening on another
    laptop sees the existing online user within one heartbeat interval
    rather than waiting up to 60s for the next tick.
    """
    user_id = uuid.UUID(current_user["sub"])
    org_id = uuid.UUID(current_user["org_id"])
    await broadcast_user_online(
        org_id=org_id,
        user_id=user_id,
        user_data=await _user_payload(db, user_id),
    )


# ── Explicit offline (best-effort on tab close) ──────────────────────


@router.post("/offline", status_code=204)
async def offline(
    current_user: dict = Depends(_current_user_from_beacon),
) -> None:
    """Tab is going away. Frontend hits this via ``navigator.sendBeacon``
    on ``visibilitychange`` / ``pagehide``. Best-effort — heartbeat
    timeout in the Durable Object covers the case where the browser
    is killed without firing this.

    Auth: accepts the JWT via either ``Authorization: Bearer`` header
    OR ``?token=`` query param, because ``sendBeacon`` can't set headers.
    """
    user_id = uuid.UUID(current_user["sub"])
    org_id = uuid.UUID(current_user["org_id"])
    await broadcast_user_offline(org_id=org_id, user_id=user_id)


# ── Editing indicator ────────────────────────────────────────────────


class EditingBody(BaseModel):
    """Payload for /api/presence/editing."""

    entity_type: Literal[
        "page", "proposal", "blog_post", "automation", "campaign", "form"
    ] = Field(
        description="The entity kind being opened for edit. Must match "
        "the entity_type the frontend EditingBanner is filtering on."
    )
    entity_id: uuid.UUID = Field(description="The row's UUID.")
    action: Literal["started", "stopped"] = Field(
        description="``started`` on edit-mode entry, ``stopped`` on exit / save."
    )


@router.post("/editing", status_code=204)
async def editing(
    body: Annotated[EditingBody, Body()],
    current_user: dict = Depends(_current_user_from_beacon),
) -> None:
    """Broadcast that the current user just started or stopped editing
    an entity. Other clients viewing the same entity will see the
    "{name} is editing this" banner appear / disappear.

    Auth: accepts the JWT via header OR ``?token=`` so the
    ``action="stopped"`` beacon at unmount works.

    NOTE: we don't look up the User row for full avatar metadata here —
    that would require RLS context, which the beacon path doesn't carry.
    The frontend already has the current user's avatar/name in session
    and reconciles the broadcast on the client side. We only emit the
    minimum needed to identify the editor.
    """
    from app.db.database import get_db_public

    user_id = uuid.UUID(current_user["sub"])
    org_id = uuid.UUID(current_user["org_id"])

    # Look up the user's display fields from a public DB session (no RLS).
    # Bounded: only their own row.
    user_data: dict = {}
    async for db in get_db_public():
        result = await db.execute(
            select(User).where(User.id == user_id, User.org_id == org_id)
        )
        user = result.scalar_one_or_none()
        if user:
            user_data = {
                "full_name": user.full_name or user.email,
                "email": user.email,
                "avatar_url": user.avatar_url,
                "role": user.role,
            }
        break

    await broadcast_entity_editing(
        org_id=org_id,
        entity_type=body.entity_type,
        entity_id=body.entity_id,
        user_id=user_id,
        user_data=user_data,
        action=body.action,
    )
