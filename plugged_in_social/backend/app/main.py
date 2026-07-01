"""Stevie Social — FastAPI Application.

Main entry point. Wires up all routers, middleware, and lifecycle events.

Run with:
    uvicorn app.main:app --reload --port 8000
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.core.config import get_settings
from app.core.rate_limit import limiter

# ── API Routers ───────────────────────────────────────────
from app.api.auth import router as auth_router
from app.api.leads import router as leads_router
from app.api.bookings import router as bookings_router
from app.api.contacts import router as contacts_router
from app.api.pages import router as pages_router
from app.api.blog import router as blog_router
from app.api.analytics import router as analytics_router
from app.api.media import router as media_router

# Phase 2 — Billing
from app.api.invoices import router as invoices_router
from app.api.subscriptions import router as subscriptions_router
from app.api.revenue import router as revenue_router
from app.api.stripe_webhook import router as stripe_webhook_router

# Phase 3 — Proposals + Onboarding
from app.api.proposals import router as proposals_router

# Phase 4 — Project Management
from app.api.projects import router as projects_router

# Phase 5 — Reporting & Analytics
from app.api.reports import router as reports_router

# Phase 6 — Email Marketing + Forms + Automation
from app.api.email_campaigns import router as email_campaigns_router
from app.api.forms import router as forms_router
from app.api.automations import router as automations_router

# Phase 7 — Video, Social Media & AI
from app.api.social import router as social_router
from app.api.social_oauth import router as social_oauth_router
from app.api.ai_content import router as ai_content_router
from app.api.video import router as video_router
from app.api.agent_assisted import router as agent_assisted_router
from app.api.virtual_agency import router as virtual_agency_router
from app.api.agency import router as agency_router

# Client Portal
from app.api.portal import router as portal_router

# coldCallAutomated Ports — Activities, Scoring, Cost Tracking
from app.api.activities import router as activities_router
from app.api.lead_scoring import router as lead_scoring_router
from app.api.cost_tracking import router as cost_tracking_router

# Real-Time Events + Team Management
from app.api.events import router as events_router
from app.api.team import router as team_router

# Admin Settings (+ unauthenticated public branding endpoint)
from app.api.settings import (
    router as settings_router,
    public_router as public_settings_router,
)

# Aurinko integration (OAuth connect + account management + booking profiles)
from app.api.integrations.aurinko import router as aurinko_integrations_router

# Public booking (unauthenticated slot availability + book/reschedule/cancel)
from app.api.public.booking import router as public_booking_router

# Collaboration — presence + concurrent-edit indicators
from app.api.presence import router as presence_router

# ── Internal Routers (Workers → FastAPI) ──────────────────
from app.api.internal.cron import router as cron_router
from app.api.internal.webhooks import router as webhooks_router
from app.api.internal.billing import router as internal_billing_router
from app.api.internal.email import router as internal_email_router
from app.api.internal.video import router as internal_video_router
from app.api.internal.ai import router as internal_ai_router
from app.api.internal.reports import router as internal_reports_router
from app.api.internal.automations import router as internal_automations_router
from app.api.internal.social import router as internal_social_router
from app.api.internal.virtual_agency import router as internal_virtual_agency_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    settings = get_settings()

    # ── HARD GATE ──────────────────────────────────────────
    # Refuse to boot in production with any known-default secret.
    # Raises RuntimeError before any traffic is accepted.
    settings.assert_production_safe()

    # Startup: verify DB connection, warm caches, etc.
    print(f"[Stevie] Starting in {settings.app_env} mode")
    print(f"[Stevie] R2 configured: {settings.r2_configured}")
    print(f"[Stevie] CF Images configured: {settings.cf_images_configured}")
    print(f"[Stevie] CF Stream configured: {settings.cf_stream_configured}")
    print(f"[Stevie] Stripe configured: {settings.stripe_configured}")
    yield
    # Shutdown: close connections, flush queues, etc.
    print("[Stevie] Shutting down")


app = FastAPI(
    title="Stevie Social API",
    description="Backend API for Stevie Social — social media agency platform.",
    version="0.1.0",
    lifespan=lifespan,
    docs_url="/docs" if get_settings().debug else None,
    redoc_url="/redoc" if get_settings().debug else None,
)


# ── Rate limiting (MED-2) ────────────────────────────────
# Register the shared Limiter on app.state so @limiter.limit decorators
# wired up inside routers find it. SlowAPIMiddleware enforces the limits
# across every request; RateLimitExceeded handler turns trips into a clean
# 429 response with Retry-After headers.
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)


# ── CORS ──────────────────────────────────────────────────

settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Global exception handler ─────────────────────────────

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Catch unhandled exceptions and return clean JSON."""
    settings = get_settings()
    detail = str(exc) if settings.debug else "Internal server error"
    return JSONResponse(status_code=500, content={"detail": detail})


# ── Health check ──────────────────────────────────────────

@app.get("/health", tags=["system"])
async def health():
    return {
        "status": "ok",
        "service": "stevie-social-api",
        "version": "0.1.0",
    }


# ── Register Routers ─────────────────────────────────────

# Public + auth
app.include_router(auth_router, prefix="/api")

# Authenticated CRUD
app.include_router(leads_router, prefix="/api")
app.include_router(bookings_router, prefix="/api")
app.include_router(contacts_router, prefix="/api")
app.include_router(pages_router, prefix="/api")
app.include_router(blog_router, prefix="/api")
app.include_router(analytics_router, prefix="/api")
app.include_router(media_router, prefix="/api")

# Phase 2 — Billing
app.include_router(invoices_router, prefix="/api")
app.include_router(subscriptions_router, prefix="/api")
app.include_router(revenue_router, prefix="/api")
app.include_router(stripe_webhook_router, prefix="/api")

# Phase 3 — Proposals + Onboarding
app.include_router(proposals_router, prefix="/api")

# Phase 4 — Project Management
app.include_router(projects_router, prefix="/api")

# Phase 5 — Reporting & Analytics
app.include_router(reports_router, prefix="/api")

# Phase 6 — Email Marketing + Forms + Automation
app.include_router(email_campaigns_router, prefix="/api")
app.include_router(forms_router, prefix="/api")
app.include_router(automations_router, prefix="/api")

# Phase 7 — Video, Social Media & AI
app.include_router(social_router, prefix="/api")
app.include_router(social_oauth_router, prefix="/api")
app.include_router(ai_content_router, prefix="/api")
app.include_router(video_router, prefix="/api")
app.include_router(agent_assisted_router, prefix="/api")
app.include_router(virtual_agency_router, prefix="/api")
app.include_router(agency_router, prefix="/api")

# Client Portal (public + portal-session auth)
app.include_router(portal_router, prefix="/api")

# coldCallAutomated Ports
app.include_router(activities_router, prefix="/api")
app.include_router(lead_scoring_router, prefix="/api")
app.include_router(cost_tracking_router, prefix="/api")

# Real-Time Events + Team Management
app.include_router(events_router, prefix="/api")
app.include_router(team_router, prefix="/api")

# Admin Settings (+ unauthenticated /api/public/branding/{slug})
app.include_router(settings_router, prefix="/api")
app.include_router(public_settings_router, prefix="/api")

# Aurinko — admin integration management
app.include_router(aurinko_integrations_router, prefix="/api")

# Public booking — unauthenticated booking flow
app.include_router(public_booking_router, prefix="/api")

# Collaboration — presence + currently-editing
app.include_router(presence_router, prefix="/api")

# Internal (Cloudflare Workers → FastAPI)
app.include_router(cron_router)
app.include_router(webhooks_router)
app.include_router(internal_billing_router)
app.include_router(internal_email_router)
app.include_router(internal_video_router)
app.include_router(internal_ai_router)
app.include_router(internal_reports_router)
app.include_router(internal_automations_router)
app.include_router(internal_social_router)
app.include_router(internal_virtual_agency_router)
