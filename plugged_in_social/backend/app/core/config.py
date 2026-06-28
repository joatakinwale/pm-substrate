"""Application settings via pydantic-settings."""
from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# Resolve the backend/.env path independent of the process CWD. pydantic-settings
# otherwise reads ".env" relative to wherever uvicorn was launched — run it from
# the repo root (instead of backend/) and all overrides silently fall through to
# the in-code defaults. That bit us on 2026-04-24 when ALLOWED_ORIGINS defaulted
# to localhost:3000 only, breaking CORS for the frontend on :3100.
_BACKEND_DIR = Path(__file__).resolve().parents[2]  # backend/app/core/config.py → backend/
_ENV_FILE = _BACKEND_DIR / ".env"


# ── Known-insecure default values ─────────────────────────────
# These sentinels MUST NOT appear in a production deployment.
# ``assert_production_safe()`` raises on startup if any of them leak in.
DEFAULT_SECRET_KEY = "change-me-in-production"
DEFAULT_JWT_SECRET_KEY = "change-me-generate-with-openssl-rand-hex-32"
DEFAULT_CRON_SECRET = "change-me-cron-secret"
DEFAULT_WEBHOOK_SECRET = "change-me-webhook-secret"


class Settings(BaseSettings):
    """Reads from .env file or environment variables."""

    model_config = SettingsConfigDict(
        env_file=str(_ENV_FILE),
        env_file_encoding="utf-8",
        case_sensitive=False,
        # Ignore unknown env vars rather than crashing the process. The
        # .env file routinely picks up keys (e.g. ``SUPABASE_ADMIN_AUTH_ID``)
        # before a matching ``Settings`` field exists, and a strict-mode
        # crash on startup is a much worse failure than an ignored key —
        # ``assert_production_safe()`` still enforces the secrets that
        # actually matter.
        extra="ignore",
    )

    # Database (Supabase PostgreSQL)
    database_url: str = "postgresql+asyncpg://postgres:password@localhost:5432/postgres"
    database_url_sync: str = "postgresql+psycopg://postgres:password@localhost:5432/postgres"

    # App
    app_env: str = "development"
    debug: bool = True
    # General application signing/encryption secret. Used for signing
    # non-auth app-internal values. DO NOT reuse this for cron or webhook
    # headers — those get dedicated secrets below so a leak of one does
    # not compromise the others.
    secret_key: str = DEFAULT_SECRET_KEY

    # Internal cron endpoints (hit by the Cloudflare cron Worker).
    # Rotate independently of secret_key and jwt_secret_key.
    cron_secret: str = DEFAULT_CRON_SECRET
    # Internal webhook-receiver endpoints (hit by the webhooks Worker
    # after it validates third-party signatures).
    webhook_secret: str = DEFAULT_WEBHOOK_SECRET

    # Supabase Auth
    supabase_url: str = ""  # e.g. https://xxxx.supabase.co
    supabase_anon_key: str = ""
    supabase_service_role_key: str = ""
    supabase_jwt_secret: str = ""  # Project Settings → API → JWT Secret

    # Custom JWT Auth (dev/testing fallback)
    jwt_secret_key: str = DEFAULT_JWT_SECRET_KEY
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 30
    jwt_refresh_token_expire_days: int = 7

    # CORS
    allowed_origins: str = "http://localhost:3000"

    # Public base URL of the user-facing frontend app (Next.js). Used by
    # the backend any time it constructs a link a human will click:
    # portal magic-link emails, proposal share URLs, team-invite callback
    # URLs, unsubscribe links, onboarding emails, etc.
    #
    # Previously this was hard-coded as "https://app.steviesocial.com" in
    # four places (team.py, proposals.py, onboarding.py, email_tasks.py),
    # which (a) made local dev awkward because every outbound link sent
    # users to prod, and (b) still referenced the legacy domain
    # "steviesocial.com" months after the frontend moved to "stevie.social".
    # Dev default matches the Next.js default port; override per-env.
    frontend_url: str = "http://localhost:3000"

    # Cloudflare Account
    cf_account_id: str = ""
    cf_api_token: str = ""

    # Cloudflare R2 (S3-compatible object storage)
    r2_access_key_id: str = ""
    r2_secret_access_key: str = ""
    r2_endpoint: str = ""
    # Default mirrors the demo bucket. Override per-env via R2_BUCKET_NAME.
    r2_bucket_name: str = "joatlabstesting"
    r2_public_url: str = ""

    # Cloudflare Images
    cf_images_account_hash: str = ""
    cf_images_delivery_url: str = ""

    # Cloudflare Stream
    cf_stream_api_token: str = ""
    cf_stream_customer_subdomain: str = ""

    # Workers
    cf_worker_upload_url: str = ""
    cf_worker_cache_url: str = ""

    # Stripe (Phase 2 — Billing)
    stripe_secret_key: str = ""
    stripe_publishable_key: str = ""
    stripe_webhook_secret: str = ""  # whsec_... from Stripe dashboard

    # Redis — used by slowapi rate-limit counters and (transitionally) the
    # SSE pub/sub fallback. NOT a task broker: background tasks moved to
    # Cloudflare Queues via ``app/services/queue_publisher.py``.
    redis_url: str = "redis://localhost:6379/0"

    # Cloudflare Queues — base URL of the queue-producer Worker.
    # Producer Worker (agents/workers/queue-producer) exposes one POST
    # endpoint per queue: ``POST {url}/{queue_name}`` forwards the body
    # to the named CF Queue. Empty by default — set ``allow_queue_drop``
    # to True in dev to make publishes no-op with a warning. In any
    # other environment an empty value raises QueueNotConfiguredError so
    # a queued row never sits stale forever.
    queue_producer_url: str = ""

    # Dev-only escape hatch. When True, missing ``queue_producer_url`` is
    # treated as a no-op (publish is dropped with a warning) instead of
    # raising. Keep this False in any environment that touches real
    # users — otherwise generations queue forever.
    allow_queue_drop: bool = False

    # Cutover flag for the Resend webhook. When False (default), the legacy
    # FastAPI handler in ``app/api/internal/webhooks.py`` logs the event
    # and returns 200 — safe if Resend still points at the legacy URL.
    # After the ``email-events`` Worker is deployed AND the Resend
    # dashboard has been repointed at it, set this to True to short-
    # circuit the legacy handler and avoid double-processing.
    cf_workers_handle_webhooks: bool = False

    # Cloudflare SSE Pub/Sub — base URL of the sse-pubsub Worker.
    # Worker (agents/workers/sse-pubsub) replaces Redis pub/sub for
    # realtime events. ``broadcast_event()`` POSTs to
    # ``{url}/publish/{org_id}`` with header ``X-Webhook-Secret`` and the
    # browser SSE/WS connects directly to ``{url}/subscribe/{org_id}``.
    # Empty in local dev — broadcasts log a warning and no-op rather than
    # blocking the API path. Production MUST set it.
    sse_pubsub_url: str = ""

    # Resend (transactional email — payment reminders, portal magic-links,
    # onboarding, notifications). Marketing bulk sends live elsewhere (see
    # project memory) and intentionally do NOT share this key so that a
    # leak or a rate-limit on one path doesn't poison the other.
    resend_api_key: str = ""
    # FROM address for all transactional email. Intentionally left empty —
    # each environment sets it to a domain-verified sender in Resend (dev
    # can use a `onboarding@resend.dev` sandbox address, staging/prod use
    # a real domain). Hard-coding a brand-specific default here ties the
    # codebase to one product name; keeping it env-driven means a rename
    # or a dummy-domain dev setup is a config change, not a code change.
    resend_from_email: str = ""
    # Reply-to defaults to the same as From, but teams often route replies
    # to a monitored inbox (support@...) while sends originate from a
    # noreply address. When empty, From is used.
    resend_reply_to: str = ""

    # AI / Claude (Phase 7 — AI Content Generation)
    anthropic_api_key: str = ""

    # Default model for AI content generation. Anything the configured
    # AI Gateway provider accepts is fair game — Anthropic IDs (e.g.
    # ``claude-sonnet-4-5``), OpenAI IDs (``gpt-4o-mini``), Workers AI
    # IDs (``@cf/meta/llama-3.1-8b-instruct``), Google (``gemini-2.5-pro``)
    # — the Worker routes by model prefix to the matching gateway path.
    # Empty string means "use the codepath default" (claude-sonnet-4-6),
    # which keeps existing deployments working without a config change.
    ai_default_model: str = ""

    # Per content_type model chains. Comma-separated list of model ids;
    # the first is the primary, the rest are fallbacks (used by the
    # Worker via Cloudflare AI Gateway's Universal Endpoint when more
    # than one is provided). Each defaults to ``ai_default_model`` when
    # empty so an instance that only sets ``AI_DEFAULT_MODEL`` keeps
    # working unchanged.
    #
    # Example for cost-aware routing:
    #   AI_MODEL_CAPTION=@cf/meta/llama-3.1-8b-instruct,gpt-4o-mini
    #   AI_MODEL_BLOG_POST=claude-sonnet-4-6,gpt-4o
    #   AI_MODEL_HASHTAGS=@cf/meta/llama-3.1-8b-instruct
    ai_model_caption: str = ""
    ai_model_blog_post: str = ""
    ai_model_email_copy: str = ""
    ai_model_hashtags: str = ""
    ai_model_script: str = ""

    # Social Platform Credentials (Phase 7 — Social Publishing)
    # Meta (Instagram + Facebook share a Graph API app)
    meta_app_id: str = ""
    meta_app_secret: str = ""
    meta_graph_api_version: str = "v19.0"

    # LinkedIn Marketing / UGC Posts API
    linkedin_client_id: str = ""
    linkedin_client_secret: str = ""

    # TikTok Content Posting API
    tiktok_client_key: str = ""
    tiktok_client_secret: str = ""

    # YouTube Data API v3 (Google OAuth)
    google_client_id: str = ""
    google_client_secret: str = ""
    youtube_api_key: str = ""  # for read-only public data

    # X (Twitter) API v2
    x_api_key: str = ""        # consumer key
    x_api_secret: str = ""     # consumer secret
    x_bearer_token: str = ""   # app-only bearer (for reads)

    # Pinterest v5 API
    pinterest_app_id: str = ""
    pinterest_app_secret: str = ""

    # Umami Analytics (self-hosted or Umami Cloud).
    # The API URL is the base (e.g. ``https://cloud.umami.is`` or your
    # self-hosted host). The default API key is a *shared* key that works
    # across orgs on the same Umami instance — individual orgs can
    # override per-website in ``Organization.settings.umami.api_key``.
    umami_api_url: str = ""
    umami_api_key: str = ""
    # Self-hosted Umami v3 doesn't expose the API Keys UI by default
    # (it's a Cloud / team-mode feature). The fallback is the
    # username + password login flow → ``POST /api/auth/login`` returns
    # a JWT we cache for ~24 hours and resend as Bearer auth. Set these
    # to your Umami admin credentials when ``umami_api_key`` is empty.
    umami_username: str = ""
    umami_password: str = ""

    # ── Aurinko (calendar / scheduling / email / contacts) ─────
    # Replaces Cal.com. The OAuth + Booking + Calendar + Contacts
    # APIs are all behind one application credential pair. Empty
    # values cause every /api/integrations/aurinko/* and
    # /api/public/booking/* path to return 503 with a clear error,
    # rather than silently no-op'ing.
    aurinko_client_id: str = ""
    aurinko_client_secret: str = ""
    # Shared secret used to verify the X-Aurinko-Signature header on
    # inbound webhooks AND to satisfy Aurinko's URL verification
    # handshake when a subscription is first created. Must match the
    # value configured on the Aurinko application.
    aurinko_signing_secret: str = ""
    # Override only for a regional Aurinko endpoint.
    aurinko_base_url: str = "https://api.aurinko.io/v1"

    # Vault / secrets-manager reference resolver.
    # When a SocialAccount.access_token_ref looks like "vault:key", we try
    # to resolve via the configured backend. In dev/Phase-1 we fall back
    # to treating ``access_token_ref`` as the raw token itself.
    vault_backend: str = "env"  # env | doppler | aws-sm (future)

    @property
    def stripe_configured(self) -> bool:
        return bool(self.stripe_secret_key)

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"

    @property
    def supabase_configured(self) -> bool:
        return bool(self.supabase_url and self.supabase_jwt_secret)

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",")]

    @property
    def r2_configured(self) -> bool:
        return bool(self.r2_access_key_id and self.r2_endpoint)

    @property
    def cf_images_configured(self) -> bool:
        return bool(self.cf_images_account_hash)

    @property
    def cf_stream_configured(self) -> bool:
        return bool(self.cf_stream_api_token)

    @property
    def umami_configured(self) -> bool:
        """True when the instance-level Umami credentials are present.

        Per-org overrides may still unlock syncing for individual orgs
        even when this is ``False`` — the sync loop checks both.
        """
        return bool(self.umami_api_url and self.umami_api_key)

    @property
    def aurinko_configured(self) -> bool:
        """True when the instance-level Aurinko credentials are present.

        All three of client id, client secret, and signing secret are
        required for the OAuth → webhook round-trip to function. A
        partial config is treated as unconfigured so the user sees a
        single 503 instead of a confusing OAuth error mid-flow.
        """
        return bool(
            self.aurinko_client_id
            and self.aurinko_client_secret
            and self.aurinko_signing_secret
        )

    @property
    def resend_configured(self) -> bool:
        # Both the API key and the FROM address are required. The FROM
        # default is deliberately empty (see ``resend_from_email`` for
        # why), so each env must set both. The dev short-circuit in
        # ``email_sender.send_transactional_email`` keeps local work
        # unblocked when either one is missing.
        return bool(self.resend_api_key and self.resend_from_email)

    def assert_production_safe(self) -> None:
        """Fail startup if production is running with known-default secrets.

        Called from the FastAPI lifespan handler. In development this is a
        no-op. In production this raises ``RuntimeError`` on the first
        misconfigured secret it finds so the process crashes loudly rather
        than accepting traffic with a public default.

        The checks cover:
          - ``secret_key``         (app-wide signing key)
          - ``jwt_secret_key``     (custom-JWT signing key)
          - ``cron_secret``        (cron endpoint shared header)
          - ``webhook_secret``     (webhook endpoint shared header)

        Also enforces a minimum secret length of 32 characters so that
        short, guessable values cannot be substituted for the defaults.
        """
        if not self.is_production:
            return

        insecure: list[str] = []

        checks = (
            ("SECRET_KEY", self.secret_key, DEFAULT_SECRET_KEY),
            ("JWT_SECRET_KEY", self.jwt_secret_key, DEFAULT_JWT_SECRET_KEY),
            ("CRON_SECRET", self.cron_secret, DEFAULT_CRON_SECRET),
            ("WEBHOOK_SECRET", self.webhook_secret, DEFAULT_WEBHOOK_SECRET),
        )

        for name, value, default in checks:
            if not value:
                insecure.append(f"{name} is empty")
            elif value == default:
                insecure.append(f"{name} is still the committed default")
            elif len(value) < 32:
                insecure.append(
                    f"{name} is shorter than 32 chars "
                    f"(got {len(value)}) — use `openssl rand -hex 32`"
                )

        if insecure:
            joined = "; ".join(insecure)
            raise RuntimeError(
                "Refusing to start in production with insecure secrets: "
                f"{joined}. Set them via environment variables and "
                "restart."
            )


@lru_cache
def get_settings() -> Settings:
    return Settings()
