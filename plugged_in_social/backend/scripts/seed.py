"""Seed script — creates Stevie Social's org and admin user.

Usage:
    cd backend
    DATABASE_URL_SYNC=postgresql+psycopg2://... python scripts/seed.py

Or with .env:
    python scripts/seed.py
"""
import os
import sys
import uuid

# Add backend/ to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv

load_dotenv()

from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.auth.passwords import hash_password


def seed():
    settings = get_settings()
    engine = create_engine(settings.database_url_sync)

    with Session(engine) as db:
        # Check if Stevie org already exists
        result = db.execute(
            text("SELECT id FROM organizations WHERE slug = 'stevie-social'")
        )
        existing = result.fetchone()

        if existing:
            org_id = existing[0]
            print(f"Stevie Social org already exists: {org_id}")
        else:
            org_id = uuid.uuid4()
            db.execute(
                text("""
                    INSERT INTO organizations (id, name, slug, plan, settings, compound_method_defaults)
                    VALUES (
                        :id, :name, :slug, :plan,
                        :settings::jsonb,
                        :compound_method_defaults::jsonb
                    )
                """),
                {
                    "id": str(org_id),
                    "name": "Stevie Social",
                    "slug": "stevie-social",
                    "plan": "pro",
                    "settings": '{"brand_color": "#089140", "accent_color": "#ff5229"}',
                    "compound_method_defaults": """{
                        "phases": [
                            {
                                "name": "Protect",
                                "description": "Lay the groundwork: tighten branding, stabilize posting cadence, and protect the client's digital presence.",
                                "metrics": ["brand_consistency_score", "posting_cadence", "profile_completeness"]
                            },
                            {
                                "name": "Deepen",
                                "description": "Build depth: increase engagement, grow community, and develop content pillars.",
                                "metrics": ["engagement_rate", "follower_growth", "content_performance"]
                            },
                            {
                                "name": "Amplify",
                                "description": "Scale results: amplify reach, drive conversions, and maximize ROI.",
                                "metrics": ["reach_growth", "lead_generation", "revenue_attribution"]
                            }
                        ],
                        "transition_trigger": "performance_signals"
                    }""",
                },
            )
            print(f"Created Stevie Social org: {org_id}")

        # Check if admin user exists
        result = db.execute(
            text("SELECT id FROM users WHERE email = 'hello@stevie.social'")
        )
        existing_user = result.fetchone()

        if existing_user:
            print(f"Admin user already exists: {existing_user[0]}")
        else:
            user_id = uuid.uuid4()
            # If SUPABASE_AUTH_ID is set, use it; otherwise create with password
            supabase_auth_id = os.getenv("SUPABASE_ADMIN_AUTH_ID")
            auth_id = supabase_auth_id or hash_password("change-me-in-production")

            db.execute(
                text("""
                    INSERT INTO users (id, org_id, auth_id, email, full_name, role, permissions)
                    VALUES (:id, :org_id, :auth_id, :email, :full_name, :role, :permissions::jsonb)
                """),
                {
                    "id": str(user_id),
                    "org_id": str(org_id),
                    "auth_id": auth_id,
                    "email": "hello@stevie.social",
                    "full_name": "Stevie Admin",
                    "role": "owner",
                    "permissions": '{"all": true}',
                },
            )
            print(f"Created admin user: {user_id} (hello@stevie.social)")

        # Create default pages
        result = db.execute(
            text("SELECT id FROM pages WHERE org_id = :org_id AND slug = 'home'"),
            {"org_id": str(org_id)},
        )
        if not result.fetchone():
            db.execute(
                text("""
                    INSERT INTO pages (org_id, slug, title, status, content)
                    VALUES (:org_id, 'home', 'Home', 'published', :content::jsonb)
                """),
                {
                    "org_id": str(org_id),
                    "content": """[
                        {"type": "hero", "headline": "Social that speaks.", "subline": "Stevie Social is a creative marketing agency for brands ready to be heard."},
                        {"type": "stats_bar", "items": [
                            {"label": "Revenue Growth", "value": "$350K"},
                            {"label": "Reach", "value": "130K+"},
                            {"label": "Followers", "value": "1,393"},
                            {"label": "Leads Increase", "value": "60%"}
                        ]},
                        {"type": "services", "headline": "The Stevie Special", "items": [
                            {"title": "Strategy", "description": "Custom roadmaps built on data, not guesswork."},
                            {"title": "Content Creation", "description": "Scroll-stopping content that converts."},
                            {"title": "Management", "description": "Full-service execution so you can focus on growth."}
                        ]}
                    ]""",
                },
            )
            print("Created home page")

        db.commit()
        print("Seed complete.")


if __name__ == "__main__":
    seed()
