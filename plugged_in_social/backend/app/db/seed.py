"""Seed script — populates dev database with test data for Stevie Social.

Usage:
    cd backend
    python -m app.db.seed

Requires DATABASE_URL_SYNC in .env (uses sync driver for simplicity).
"""
import uuid
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models import (
    AnalyticsDaily,
    AuditLog,
    BlogPost,
    Booking,
    Contact,
    Lead,
    Organization,
    Page,
    User,
)

settings = get_settings()


def seed_database() -> None:
    """Insert sample data for local development."""
    engine = create_engine(settings.database_url_sync, echo=True)

    with Session(engine) as session:
        # ── Check if already seeded ──
        existing = session.execute(
            text("SELECT count(*) FROM organizations")
        ).scalar()
        if existing and existing > 0:
            print("Database already seeded. Skipping.")
            return

        now = datetime.now(timezone.utc)

        # ══════════════════════════════════════════
        # Organization
        # ══════════════════════════════════════════
        org = Organization(
            id=uuid.UUID("00000000-0000-0000-0000-000000000001"),
            name="Stevie Social",
            slug="stevie-social",
            plan="pro",
            domain="stevie.social",
            settings={
                "brand_colors": {
                    "primary": "#089140",
                    "accent": "#ff5229",
                    "sky": "#7ac9e8",
                    "chartreuse": "#edff6b",
                    "lavender": "#d1bff2",
                },
                "timezone": "America/New_York",
            },
            compound_method_defaults={
                "phases": ["protect", "deepen", "amplify"],
                "default_duration_weeks": 12,
            },
        )
        session.add(org)
        session.flush()

        # ══════════════════════════════════════════
        # Users
        # ══════════════════════════════════════════
        kelsie = User(
            id=uuid.UUID("00000000-0000-0000-0000-000000000010"),
            org_id=org.id,
            email="kelsie@stevie.social",
            full_name="Kelsie",
            role="owner",
            permissions={"can_manage_billing": True},
        )
        emmanuel = User(
            id=uuid.UUID("00000000-0000-0000-0000-000000000011"),
            org_id=org.id,
            email="emmanuel@joatlabs.com",
            full_name="Emmanuel Akinwale",
            role="admin",
            permissions={"developer": True},
        )
        session.add_all([kelsie, emmanuel])
        session.flush()

        # ══════════════════════════════════════════
        # Leads
        # ══════════════════════════════════════════
        leads_data = [
            {
                "email": "sarah@brightside-wellness.com",
                "full_name": "Sarah Chen",
                "company": "Brightside Wellness",
                "revenue_range": "500k_1m",
                "qualification_status": "qualified",
                "score": 85,
                "source": "instagram",
                "form_responses": {
                    "industry": "wellness",
                    "team_size": "5-10",
                    "goals": ["brand awareness", "lead generation"],
                    "budget_range": "$3k-$5k/mo",
                },
            },
            {
                "email": "marcus@urban-eats.co",
                "full_name": "Marcus Johnson",
                "company": "Urban Eats",
                "revenue_range": "1m_5m",
                "qualification_status": "new",
                "score": None,
                "source": "referral",
                "form_responses": {
                    "industry": "food & beverage",
                    "team_size": "11-25",
                    "goals": ["social media management", "content creation"],
                },
            },
            {
                "email": "diana@peak-fitness.com",
                "full_name": "Diana Rodriguez",
                "company": "Peak Fitness Studios",
                "revenue_range": "100k_500k",
                "qualification_status": "reviewing",
                "score": 62,
                "source": "website",
                "form_responses": {
                    "industry": "fitness",
                    "team_size": "1-4",
                    "goals": ["content creation"],
                },
            },
        ]

        lead_objects = []
        for ld in leads_data:
            lead = Lead(org_id=org.id, **ld)
            lead_objects.append(lead)
        session.add_all(lead_objects)
        session.flush()

        # ══════════════════════════════════════════
        # Bookings
        # ══════════════════════════════════════════
        bookings_data = [
            Booking(
                org_id=org.id,
                lead_id=lead_objects[0].id,
                provider="aurinko",
                external_event_id="aurinko_evt_seed_001",
                event_type="discovery_call",
                scheduled_at=now + timedelta(days=2, hours=10),
                duration_minutes=30,
                timezone="America/New_York",
                attendee_name="Sarah Chen",
                attendee_email="sarah@brightside-wellness.com",
                status="confirmed",
                meeting_url="https://meet.google.com/seed-sarah-chen",
            ),
            Booking(
                org_id=org.id,
                lead_id=lead_objects[2].id,
                provider="aurinko",
                external_event_id="aurinko_evt_seed_002",
                event_type="discovery_call",
                scheduled_at=now + timedelta(days=5, hours=14),
                duration_minutes=30,
                timezone="America/New_York",
                attendee_name="Diana Rodriguez",
                attendee_email="diana@peak-fitness.com",
                status="pending",
            ),
        ]
        session.add_all(bookings_data)

        # ══════════════════════════════════════════
        # Contacts (email subscribers)
        # ══════════════════════════════════════════
        contacts_data = [
            Contact(
                org_id=org.id,
                email="sarah@brightside-wellness.com",
                full_name="Sarah Chen",
                tags=["lead", "newsletter", "wellness"],
                engagement_score=72,
                source="website_signup",
            ),
            Contact(
                org_id=org.id,
                email="fan@example.com",
                full_name="Jordan Blake",
                tags=["newsletter", "lead-magnet"],
                engagement_score=45,
                source="lead_magnet",
            ),
            Contact(
                org_id=org.id,
                email="imported@flodesk.com",
                full_name="Flodesk Import User",
                tags=["flodesk_import", "newsletter"],
                engagement_score=10,
                source="flodesk_import",
            ),
        ]
        session.add_all(contacts_data)

        # ══════════════════════════════════════════
        # Pages
        # ══════════════════════════════════════════
        pages_data = [
            Page(
                org_id=org.id,
                slug="homepage",
                title="Homepage",
                status="published",
                version=3,
                last_edited_by=kelsie.id,
                content=[
                    {
                        "type": "hero",
                        "headline": "Social that speaks.",
                        "subline": "We turn scroll-stoppers into revenue drivers.",
                        "cta_text": "Book a Discovery Call",
                        "cta_url": "/book",
                    },
                    {
                        "type": "stats_bar",
                        "items": [
                            {"label": "Revenue Generated", "value": "$350K"},
                            {"label": "Impressions", "value": "130K+"},
                            {"label": "Engagement Rate", "value": "1,393"},
                        ],
                    },
                    {
                        "type": "services",
                        "items": [
                            {"title": "Content Creation", "description": "Scroll-stopping content..."},
                            {"title": "Social Management", "description": "Full-service social..."},
                            {"title": "Paid Advertising", "description": "ROI-focused ad campaigns..."},
                        ],
                    },
                ],
            ),
            Page(
                org_id=org.id,
                slug="about",
                title="About Stevie Social",
                status="published",
                version=1,
                last_edited_by=kelsie.id,
                content=[
                    {
                        "type": "hero",
                        "headline": "Built by creators, for creators.",
                        "subline": "We're not just another agency.",
                    },
                    {
                        "type": "text_block",
                        "body": "Stevie Social was founded with one mission: make social media actually work for businesses.",
                    },
                ],
            ),
            Page(
                org_id=org.id,
                slug="portfolio",
                title="Our Work",
                status="draft",
                version=1,
                content=[],
            ),
        ]
        session.add_all(pages_data)

        # ══════════════════════════════════════════
        # Blog Posts
        # ══════════════════════════════════════════
        blog_posts_data = [
            BlogPost(
                org_id=org.id,
                slug="why-your-social-isnt-working",
                title="Why Your Social Media Isn't Working (And What to Do About It)",
                body="<h2>The real problem isn't your content.</h2><p>Most brands think they need better content. What they actually need is a better strategy...</p>",
                excerpt="Most brands think they need better content. What they actually need is a better strategy.",
                category="strategy",
                tags=["social-media", "strategy", "tips"],
                status="published",
                published_at=now - timedelta(days=14),
                author_id=kelsie.id,
                version=2,
                reading_time_minutes=5,
            ),
            BlogPost(
                org_id=org.id,
                slug="compound-method-explained",
                title="The Compound Method: Our 3-Phase Approach to Social Growth",
                body="<h2>Protect. Deepen. Amplify.</h2><p>Every brand we work with goes through our proprietary Compound Method...</p>",
                excerpt="Every brand we work with goes through our proprietary Compound Method.",
                category="methodology",
                tags=["compound-method", "process", "growth"],
                status="draft",
                author_id=kelsie.id,
                version=1,
                reading_time_minutes=8,
            ),
        ]
        session.add_all(blog_posts_data)

        # ══════════════════════════════════════════
        # Analytics Daily
        # ══════════════════════════════════════════
        today = date.today()
        analytics_data = []
        for days_ago in range(7):
            d = today - timedelta(days=days_ago)
            analytics_data.extend([
                AnalyticsDaily(
                    org_id=org.id, date=d,
                    metric_type="page_views",
                    value=150 + (days_ago * 10),
                    dimensions={},
                ),
                AnalyticsDaily(
                    org_id=org.id, date=d,
                    metric_type="unique_visitors",
                    value=85 + (days_ago * 5),
                    dimensions={},
                ),
                AnalyticsDaily(
                    org_id=org.id, date=d,
                    metric_type="form_submissions",
                    value=3 if days_ago % 2 == 0 else 1,
                    dimensions={},
                ),
                AnalyticsDaily(
                    org_id=org.id, date=d,
                    metric_type="email_signups",
                    value=2 if days_ago % 3 == 0 else 0,
                    dimensions={},
                ),
            ])
        session.add_all(analytics_data)

        # ══════════════════════════════════════════
        # Audit Log entries
        # ══════════════════════════════════════════
        audit_entries = [
            AuditLog(
                org_id=org.id,
                user_id=kelsie.id,
                action="create",
                entity_type="page",
                entity_id=str(pages_data[0].id),
                diff={"title": {"old": None, "new": "Homepage"}},
            ),
            AuditLog(
                org_id=org.id,
                user_id=kelsie.id,
                action="publish",
                entity_type="blog_post",
                entity_id=str(blog_posts_data[0].id),
                diff={"status": {"old": "draft", "new": "published"}},
            ),
        ]
        session.add_all(audit_entries)

        session.commit()
        print("Seed data inserted successfully!")
        print(f"  - 1 organization: {org.name}")
        print(f"  - 2 users: Kelsie (owner), Emmanuel (admin)")
        print(f"  - 3 leads")
        print(f"  - 2 bookings")
        print(f"  - 3 contacts")
        print(f"  - 3 pages")
        print(f"  - 2 blog posts")
        print(f"  - {len(analytics_data)} analytics entries (7 days)")
        print(f"  - 2 audit log entries")


if __name__ == "__main__":
    seed_database()
