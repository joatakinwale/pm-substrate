"""Bootstrap a REAL demo environment — no fake data.

Creates:
  1. The owner's org (or finds it if it already exists).
  2. Your teammate org.
  3. 4 brand voice profiles in the owner's org.
  4. Sends Supabase invite emails to both addresses so they can sign in.

Everything else (leads, bookings, posts, campaigns) is created LIVE during
the demo by the actual product flows. This script does NOT seed mock data.

Usage:
    cd backend
    python scripts/bootstrap_real_demo.py \\
        --owner-email "owner@example.com" \\
        --owner-name "Owner Name" \\
        --owner-org-name "Owner's Agency" \\
        --teammate-email "etastic@example.com" \\
        --teammate-name "Etastic" \\
        --teammate-org-name "JOAT Labs"

Idempotent — re-running skips orgs/profiles that already exist.
"""

from __future__ import annotations

import argparse
import asyncio
import os
import sys
import uuid
from typing import Any

# Add backend/ to path so this script runs from anywhere
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv

load_dotenv()

import httpx
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

from app.core.config import get_settings


# ── 4 brand voices we always seed in the owner's org ──────────────────
#
# These are deliberately distinct so the AI Content demo can show the
# tone shift live. The descriptors land on real prompt variations once
# the AI Worker generates content against them.
BRAND_VOICES: list[dict[str, Any]] = [
    {
        "name": "JOAT Friendly",
        "description": "Warm, approachable, conversational. First-person. Light humor.",
        "tone": "warm",
        "example_phrases": [
            "Hey there, just a quick heads-up...",
            "We thought you'd want to know...",
            "Real talk:",
        ],
        "avoid_phrases": ["leveraging", "synergy", "ecosystem"],
    },
    {
        "name": "JOAT Authority",
        "description": "Confident, data-led, executive-grade. Third person. No hedging.",
        "tone": "authoritative",
        "example_phrases": [
            "Three numbers tell the story:",
            "The market signal is clear:",
            "Data shows:",
        ],
        "avoid_phrases": ["maybe", "we think", "kind of"],
    },
    {
        "name": "JOAT Playful",
        "description": "Energetic, irreverent, social-media-native. Short sentences. Earned exclamation marks only.",
        "tone": "playful",
        "example_phrases": [
            "Plot twist:",
            "Okay this is wild —",
            "We were today years old when we learned...",
        ],
        "avoid_phrases": ["regards", "pursuant to", "kindly"],
    },
    {
        "name": "JOAT Technical",
        "description": "Precise, jargon-aware, builder-to-builder. Lists OK, numbers OK, no marketing-speak.",
        "tone": "technical",
        "example_phrases": [
            "Architecture: ",
            "Trade-offs:",
            "Constraints:",
        ],
        "avoid_phrases": ["revolutionary", "game-changing", "next-gen"],
    },
]


def _slugify(value: str) -> str:
    """Lowercase, dashes, alpha-num-only — same shape as Organization.slug."""
    import re

    cleaned = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return cleaned or "stevie-org"


def _ensure_org(db: Session, *, name: str, slug: str) -> uuid.UUID:
    """Find-or-create an Organization. Returns its id."""
    result = db.execute(
        text("SELECT id FROM organizations WHERE slug = :slug"),
        {"slug": slug},
    ).fetchone()
    if result:
        print(f"  ✓ org '{slug}' already exists ({result[0]})")
        return uuid.UUID(str(result[0]))

    org_id = uuid.uuid4()
    db.execute(
        text(
            """
            INSERT INTO organizations (id, name, slug, plan, settings, compound_method_defaults, is_active)
            VALUES (
                :id, :name, :slug, 'starter',
                '{}'::jsonb, '{}'::jsonb, true
            )
            """
        ),
        {"id": str(org_id), "name": name, "slug": slug},
    )
    db.commit()
    print(f"  ✓ created org '{slug}' ({org_id})")
    return org_id


def _ensure_brand_voices(db: Session, *, org_id: uuid.UUID) -> int:
    """Create the 4 demo brand voices in the org if they don't already exist."""
    created = 0
    for voice in BRAND_VOICES:
        exists = db.execute(
            text(
                """
                SELECT 1 FROM brand_voice_profiles
                 WHERE org_id = :org AND name = :name
                """
            ),
            {"org": str(org_id), "name": voice["name"]},
        ).fetchone()
        if exists:
            print(f"  ✓ brand voice '{voice['name']}' already exists")
            continue

        # Schema may vary slightly — adjust column names if your migration
        # used different ones. The shape below matches the tested model.
        db.execute(
            text(
                """
                INSERT INTO brand_voice_profiles (
                    id, org_id, name, description, tone,
                    example_phrases, avoid_phrases, created_at, updated_at
                ) VALUES (
                    :id, :org, :name, :desc, :tone,
                    :examples, :avoid, now(), now()
                )
                """
            ),
            {
                "id": str(uuid.uuid4()),
                "org": str(org_id),
                "name": voice["name"],
                "desc": voice["description"],
                "tone": voice["tone"],
                "examples": voice["example_phrases"],
                "avoid": voice["avoid_phrases"],
            },
        )
        created += 1
        print(f"  ✓ created brand voice '{voice['name']}'")
    db.commit()
    return created


async def _send_supabase_invite(
    *, email: str, full_name: str, org_id: uuid.UUID, role: str
) -> dict | None:
    """Generate a Supabase invite link and trigger the branded invite email.

    Uses the existing service helpers so the demo invite goes through the
    same path a real production invite would.
    """
    from app.auth.supabase import generate_supabase_invite_link
    from app.services.team_invites import queue_invite_email

    settings = get_settings()
    redirect_to = (
        f"{settings.frontend_url.rstrip('/')}/auth/callback?next=/admin"
    )

    invite = await generate_supabase_invite_link(
        email=email,
        redirect_to=redirect_to,
        app_metadata={"org_id": str(org_id), "role": role},
        user_metadata={"full_name": full_name},
    )
    if not invite:
        print(
            f"  ✗ Supabase invite generation failed for {email} — "
            "check SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY"
        )
        return None

    print(f"  ✓ Supabase invite generated for {email}")

    try:
        await queue_invite_email(
            to_email=email,
            full_name=full_name,
            org_name="Stevie Social",
            inviter_name="Stevie Social",
            role=role,
            action_link=invite["action_link"],
            org_id=str(org_id),
        )
        print(f"  ✓ branded invite email queued via Resend for {email}")
    except Exception as exc:
        print(
            f"  ⚠ branded invite email failed ({exc}); "
            f"action_link still works: {invite['action_link']}"
        )

    return invite


async def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--owner-email", required=True)
    parser.add_argument("--owner-name", required=True)
    parser.add_argument("--owner-org-name", default=None)
    parser.add_argument("--teammate-email", required=True)
    parser.add_argument("--teammate-name", required=True)
    parser.add_argument("--teammate-org-name", default="JOAT Labs")
    parser.add_argument(
        "--skip-invites",
        action="store_true",
        help="Skip Supabase invite email generation (orgs + voices only).",
    )
    args = parser.parse_args()

    owner_org_name = args.owner_org_name or f"{args.owner_name}'s Agency"
    owner_org_slug = _slugify(owner_org_name)
    teammate_org_slug = _slugify(args.teammate_org_name)

    settings = get_settings()
    if not settings.database_url_sync:
        print("✗ DATABASE_URL_SYNC not configured")
        sys.exit(1)

    print("\n═══ Stevie Social — bootstrap real demo ═══\n")

    # Step 1: Orgs + brand voices (sync DB work)
    engine = create_engine(settings.database_url_sync)
    with Session(engine) as db:
        print("Step 1 — orgs:")
        owner_org_id = _ensure_org(db, name=owner_org_name, slug=owner_org_slug)
        teammate_org_id = _ensure_org(
            db, name=args.teammate_org_name, slug=teammate_org_slug
        )

        print("\nStep 2 — brand voices in owner org:")
        _ensure_brand_voices(db, org_id=owner_org_id)

    # Step 3: Async Supabase invites (calls the admin API)
    if not args.skip_invites:
        print("\nStep 3 — Supabase invites:")
        await _send_supabase_invite(
            email=args.owner_email,
            full_name=args.owner_name,
            org_id=owner_org_id,
            role="owner",
        )
        await _send_supabase_invite(
            email=args.teammate_email,
            full_name=args.teammate_name,
            org_id=teammate_org_id,
            role="owner",
        )
    else:
        print("\nStep 3 — skipped (--skip-invites)")

    print("\n═══ done ═══")
    print(f"  Owner org:    {owner_org_id}  ({owner_org_slug})")
    print(f"  Teammate org: {teammate_org_id}  ({teammate_org_slug})")
    print("\nNext: have both invitees check their inbox + click the invite link.")
    print("Everything else (leads, bookings, posts) is created live during the demo.\n")


if __name__ == "__main__":
    asyncio.run(main())
