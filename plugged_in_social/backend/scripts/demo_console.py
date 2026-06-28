"""Stevie demo console — interactive CLI to drive a live demo.

Run:
    cd backend
    python scripts/demo_console.py

What it does:
    - Validates each external integration is wired (Stripe / Resend /
      Anthropic / Cloudflare Images+Stream+R2 / Aurinko booking webhook /
      Umami / Supabase).
    - Lets you trigger demo-time actions on demand:
        - fire a fake Aurinko booking
        - send a Stripe test payment + webhook
        - send a test transactional email
        - generate AI content
        - emit a test SSE toast (lead.created, presence.online, etc.)
        - upload a sample image to Cloudflare Images
        - upload a sample video to Cloudflare Stream (direct upload URL)

Designed for two scenarios:
    1. Pre-demo smoke test — walk every menu option to confirm it works.
    2. During-demo recovery — if something refuses to fire on stage, run
       the matching console action in your backstage terminal.
"""

from __future__ import annotations

import asyncio
import os
import sys
import uuid
from datetime import datetime, timezone
from typing import Awaitable, Callable

# Add backend/ to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv

load_dotenv()

import httpx

try:
    from rich.console import Console
    from rich.panel import Panel
    from rich.prompt import Prompt
    from rich.table import Table
    from rich.text import Text

    _HAS_RICH = True
except ImportError:  # pragma: no cover — fallback so the script runs anywhere
    _HAS_RICH = False
    Console = None  # type: ignore

from app.core.config import get_settings


# ── pretty-printing helpers (degrade if rich isn't installed) ─────────


class _PlainConsole:
    """Tiny shim so the script runs even without rich installed."""

    def print(self, *args, **kwargs) -> None:  # noqa: D401
        print(*args)

    def rule(self, title: str = "") -> None:
        print(f"\n── {title} ──\n" if title else "─" * 60)

    def status(self, msg: str):  # noqa: D401
        class _Ctx:
            def __enter__(self_inner):
                print(f"  ⏳ {msg}")
                return self_inner

            def __exit__(self_inner, *a):
                pass

        return _Ctx()


console = Console() if _HAS_RICH else _PlainConsole()


def _ok(msg: str) -> None:
    if _HAS_RICH:
        console.print(f"  [green]✓[/green] {msg}")
    else:
        console.print(f"  ✓ {msg}")


def _fail(msg: str) -> None:
    if _HAS_RICH:
        console.print(f"  [red]✗[/red] {msg}")
    else:
        console.print(f"  ✗ {msg}")


def _info(msg: str) -> None:
    if _HAS_RICH:
        console.print(f"  [cyan]·[/cyan] {msg}")
    else:
        console.print(f"  · {msg}")


# ── Integration validators ───────────────────────────────────────────


async def check_supabase() -> bool:
    s = get_settings()
    if not s.supabase_url or not s.supabase_jwt_secret:
        _fail("Supabase: SUPABASE_URL / SUPABASE_JWT_SECRET missing")
        return False
    async with httpx.AsyncClient(timeout=5.0) as c:
        try:
            r = await c.get(f"{s.supabase_url}/auth/v1/.well-known/jwks.json")
            if r.status_code == 200 and r.json().get("keys"):
                _ok(f"Supabase JWKS reachable ({len(r.json()['keys'])} keys)")
                return True
            _fail(f"Supabase JWKS returned {r.status_code}")
            return False
        except Exception as e:
            _fail(f"Supabase JWKS unreachable: {e}")
            return False


async def check_anthropic() -> bool:
    s = get_settings()
    if not s.anthropic_api_key:
        _fail("Anthropic: ANTHROPIC_API_KEY missing")
        return False
    async with httpx.AsyncClient(timeout=10.0) as c:
        try:
            # Cheapest possible probe — POST a 1-token request.
            r = await c.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": s.anthropic_api_key,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
                },
                json={
                    "model": "claude-haiku-4-5-20251001",
                    "max_tokens": 4,
                    "messages": [{"role": "user", "content": "ping"}],
                },
            )
            if r.status_code == 200:
                _ok("Anthropic API responded")
                return True
            _fail(f"Anthropic API returned {r.status_code}: {r.text[:120]}")
            return False
        except Exception as e:
            _fail(f"Anthropic unreachable: {e}")
            return False


async def check_resend() -> bool:
    s = get_settings()
    if not s.resend_api_key:
        _fail("Resend: RESEND_API_KEY missing")
        return False
    if not s.resend_from_email:
        _fail("Resend: RESEND_FROM_EMAIL missing (need verified sender)")
        return False
    async with httpx.AsyncClient(timeout=5.0) as c:
        try:
            r = await c.get(
                "https://api.resend.com/domains",
                headers={"Authorization": f"Bearer {s.resend_api_key}"},
            )
            if r.status_code == 200:
                domains = r.json().get("data", [])
                verified = [d for d in domains if d.get("status") == "verified"]
                if verified:
                    _ok(
                        f"Resend reachable, {len(verified)} verified domain(s); "
                        f"FROM={s.resend_from_email}"
                    )
                    return True
                _fail(
                    "Resend reachable but no verified domains — emails will "
                    "deliver to your test inbox only."
                )
                return False
            _fail(f"Resend API returned {r.status_code}")
            return False
        except Exception as e:
            _fail(f"Resend unreachable: {e}")
            return False


async def check_stripe() -> bool:
    s = get_settings()
    if not s.stripe_secret_key:
        _fail("Stripe: STRIPE_SECRET_KEY missing")
        return False
    async with httpx.AsyncClient(timeout=5.0) as c:
        try:
            r = await c.get(
                "https://api.stripe.com/v1/account",
                auth=(s.stripe_secret_key, ""),
            )
            if r.status_code == 200:
                acct = r.json()
                mode = "test" if "sk_test_" in s.stripe_secret_key else "LIVE"
                _ok(
                    f"Stripe ({mode}) connected — account "
                    f"{acct.get('id')} / {acct.get('email')}"
                )
                return True
            _fail(f"Stripe returned {r.status_code}: {r.text[:120]}")
            return False
        except Exception as e:
            _fail(f"Stripe unreachable: {e}")
            return False


async def check_cloudflare_images() -> bool:
    s = get_settings()
    if not (s.cf_account_id and s.cf_api_token):
        _fail("Cloudflare: CF_ACCOUNT_ID / CF_API_TOKEN missing")
        return False
    async with httpx.AsyncClient(timeout=5.0) as c:
        try:
            r = await c.get(
                f"https://api.cloudflare.com/client/v4/accounts/{s.cf_account_id}/images/v1/stats",
                headers={"Authorization": f"Bearer {s.cf_api_token}"},
            )
            if r.status_code == 200:
                _ok("Cloudflare Images reachable")
                return True
            _fail(f"Cloudflare Images returned {r.status_code}: {r.text[:120]}")
            return False
        except Exception as e:
            _fail(f"Cloudflare Images unreachable: {e}")
            return False


async def check_cloudflare_stream() -> bool:
    s = get_settings()
    if not s.cf_stream_api_token:
        _fail("Cloudflare Stream: CF_STREAM_API_TOKEN missing")
        return False
    if not s.cf_account_id:
        _fail("Cloudflare Stream: CF_ACCOUNT_ID missing")
        return False
    async with httpx.AsyncClient(timeout=5.0) as c:
        try:
            r = await c.get(
                f"https://api.cloudflare.com/client/v4/accounts/{s.cf_account_id}/stream",
                headers={"Authorization": f"Bearer {s.cf_stream_api_token}"},
            )
            if r.status_code == 200:
                count = len(r.json().get("result") or [])
                _ok(f"Cloudflare Stream reachable ({count} videos so far)")
                return True
            _fail(f"Cloudflare Stream returned {r.status_code}")
            return False
        except Exception as e:
            _fail(f"Cloudflare Stream unreachable: {e}")
            return False


async def check_umami() -> bool:
    s = get_settings()
    if not s.umami_api_url:
        _info("Umami: UMAMI_API_URL not set (skipping)")
        return False
    has_api_key = bool(s.umami_api_key)
    has_login = bool(s.umami_username and s.umami_password)
    if not (has_api_key or has_login):
        _info(
            "Umami: neither UMAMI_API_KEY nor (UMAMI_USERNAME + "
            "UMAMI_PASSWORD) is set (skipping)"
        )
        return False

    base = s.umami_api_url.rstrip("/")
    async with httpx.AsyncClient(timeout=5.0) as c:
        try:
            # Get a bearer token. API key path = use it directly. No
            # API key path = log in with username/password and use the
            # JWT the same way the runtime service will.
            if has_api_key:
                token = s.umami_api_key
                source = "API key"
            else:
                login = await c.post(
                    f"{base}/api/auth/login",
                    json={
                        "username": s.umami_username,
                        "password": s.umami_password,
                    },
                )
                if login.status_code != 200:
                    _fail(
                        f"Umami /api/auth/login returned "
                        f"{login.status_code}: {login.text[:120]}"
                    )
                    return False
                token = login.json().get("token", "")
                if not token:
                    _fail("Umami login succeeded but returned no token")
                    return False
                source = "username+password JWT"

            r = await c.get(
                f"{base}/api/me",
                headers={
                    "Authorization": f"Bearer {token}",
                    **(
                        {"x-umami-api-key": token}
                        if has_api_key
                        else {}
                    ),
                },
            )
            if r.status_code == 200:
                _ok(f"Umami reachable (auth: {source})")
                return True
            _fail(f"Umami /api/me returned {r.status_code}")
            return False
        except Exception as e:
            _fail(f"Umami unreachable: {e}")
            return False


async def check_backend_health() -> bool:
    """Ping the backend's own /health on whatever URL is configured."""
    base = os.environ.get("STEVIE_BACKEND_URL", "http://localhost:8080")
    async with httpx.AsyncClient(timeout=3.0) as c:
        try:
            r = await c.get(f"{base}/health")
            if r.status_code == 200:
                _ok(f"Backend reachable at {base}")
                return True
            _fail(f"Backend at {base} returned {r.status_code}")
            return False
        except Exception as e:
            _fail(f"Backend at {base} unreachable: {e}")
            return False


CHECKS: list[tuple[str, Callable[[], Awaitable[bool]]]] = [
    ("Backend /health", check_backend_health),
    ("Supabase JWKS", check_supabase),
    ("Anthropic", check_anthropic),
    ("Resend", check_resend),
    ("Stripe", check_stripe),
    ("Cloudflare Images", check_cloudflare_images),
    ("Cloudflare Stream", check_cloudflare_stream),
    ("Umami", check_umami),
]


async def run_all_checks() -> None:
    console.rule("Pre-demo integration sweep")
    for name, fn in CHECKS:
        _info(name)
        await fn()
    console.rule("done")


# ── Demo-time actions ────────────────────────────────────────────────


def _backend_url() -> str:
    return os.environ.get("STEVIE_BACKEND_URL", "http://localhost:8080")


def _webhook_secret() -> str:
    return get_settings().webhook_secret


async def fire_fake_aurinko_booking() -> None:
    """Fire a synthetic Aurinko booking-resource webhook at our own handler.

    The handler needs an ``integration_accounts`` row whose
    ``aurinko_account_id`` matches the ``accountId`` in the payload —
    otherwise the lookup short-circuits with a warning (and no Booking
    row gets written). When you have an account connected end-to-end
    via the UI, copy its Aurinko account id from the connected-account
    panel and paste it here.
    """
    import hashlib
    import hmac as _hmac
    import json as _json

    settings = get_settings()
    if not settings.aurinko_signing_secret:
        _fail(
            "AURINKO_SIGNING_SECRET is not set — the webhook handler will "
            "reject the synthetic POST. Set it in backend/.env first."
        )
        return

    aurinko_account_id_raw = (
        Prompt.ask("Aurinko accountId (from the connected-account panel)")
        if _HAS_RICH
        else input("Aurinko accountId: ")
    )
    try:
        aurinko_account_id = int(aurinko_account_id_raw)
    except ValueError:
        _fail("accountId must be a number.")
        return

    booking_id = int(uuid.uuid4().int % 10_000_000)
    body = {
        "subscription": 0,
        "resource": f"/booking/{booking_id}",
        "accountId": aurinko_account_id,
        "payloads": [
            {
                "bookingId": booking_id,
                "calendarId": "primary",
                "eventId": f"evt_{uuid.uuid4().hex[:12]}",
            }
        ],
    }
    raw = _json.dumps(body, separators=(",", ":")).encode()
    signature = _hmac.new(
        settings.aurinko_signing_secret.encode(),
        raw,
        hashlib.sha256,
    ).hexdigest()
    async with httpx.AsyncClient(timeout=10.0) as c:
        r = await c.post(
            f"{_backend_url()}/api/internal/webhooks/aurinko",
            content=raw,
            headers={
                "Content-Type": "application/json",
                "X-Aurinko-Signature": signature,
            },
        )
    if r.status_code < 400:
        _ok(f"Fake booking webhook dispatched ({r.status_code}): {r.text[:200]}")
    else:
        _fail(f"Backend returned {r.status_code}: {r.text[:200]}")


async def trigger_stripe_test_payment() -> None:
    """Create a Stripe test invoice and immediately pay it with a test
    card via the PaymentIntent API. The Stripe webhook to our backend
    fires automatically and the invoice flips to Paid in admin.
    """
    s = get_settings()
    if not s.stripe_secret_key:
        _fail("STRIPE_SECRET_KEY not set")
        return

    customer_email = Prompt.ask(
        "Stripe customer email",
        default="demo@example.com",
    ) if _HAS_RICH else input("Customer email [demo@example.com]: ") or "demo@example.com"
    amount = int(
        (
            Prompt.ask("Amount (USD)", default="50")
            if _HAS_RICH
            else input("Amount USD [50]: ") or "50"
        )
    ) * 100  # cents

    async with httpx.AsyncClient(timeout=10.0, auth=(s.stripe_secret_key, "")) as c:
        # 1. Find or create a customer
        cust = await c.post(
            "https://api.stripe.com/v1/customers",
            data={"email": customer_email, "name": "Demo Customer"},
        )
        if cust.status_code >= 400:
            _fail(f"Stripe customer create failed: {cust.text[:200]}")
            return
        customer_id = cust.json()["id"]
        _ok(f"Stripe customer {customer_id}")

        # 2. Create a PaymentIntent paid with the off-session test card.
        #    pm_card_visa is Stripe's universal "succeeds" test PM.
        pi = await c.post(
            "https://api.stripe.com/v1/payment_intents",
            data={
                "amount": str(amount),
                "currency": "usd",
                "customer": customer_id,
                "payment_method": "pm_card_visa",
                "off_session": "true",
                "confirm": "true",
            },
        )
        if pi.status_code >= 400:
            _fail(f"PaymentIntent failed: {pi.text[:200]}")
            return
        pi_data = pi.json()
        _ok(
            f"PaymentIntent {pi_data['id']} status={pi_data['status']} "
            f"amount=${amount/100:.2f}"
        )
        _info(
            "Webhook should now fire to /api/stripe/webhook within a few "
            "seconds — watch your admin Billing screen for the toast."
        )


async def send_test_email() -> None:
    """Fire a one-off transactional email through our own send path so
    the demo can prove Resend works end-to-end.
    """
    org_id = Prompt.ask(
        "Org UUID",
        default="00000000-0000-0000-0000-000000000000",
    ) if _HAS_RICH else input("Org UUID: ")
    to_email = Prompt.ask(
        "Recipient email",
        default="emmanuel.t.akinwale@gmail.com",
    ) if _HAS_RICH else input("Recipient email: ")

    from app.services.queue_publisher import publish_email_notification

    try:
        await publish_email_notification(
            org_id=org_id,
            to=to_email,
            subject="Stevie console test — you can ignore this",
            html_body=(
                "<p>This is a test email triggered from the Stevie demo console.</p>"
                "<p>If you're reading this, Resend + the email-sender Worker "
                "are both working.</p>"
                f"<p>Fired at {datetime.now(timezone.utc).isoformat()}.</p>"
            ),
        )
        _ok(f"Email enqueued to {to_email}")
    except Exception as e:
        _fail(f"Email enqueue failed: {e}")


async def emit_test_sse_event() -> None:
    """Broadcast a synthetic event through the SSE pubsub Worker so any
    connected admin tabs see a live toast appear. Useful to prove the
    realtime path is alive WITHOUT having to actually mutate data.
    """
    org_id = Prompt.ask(
        "Org UUID to broadcast to",
        default="00000000-0000-0000-0000-000000000000",
    ) if _HAS_RICH else input("Org UUID: ")

    from app.services.realtime import broadcast_event

    try:
        await broadcast_event(
            org_id=org_id,
            event_type="lead.created",
            entity_type="lead",
            entity_id=str(uuid.uuid4()),
            payload={
                "lead_id": str(uuid.uuid4()),
                "action": "created",
                "full_name": "Console Test",
                "email": "console@test.example",
                "company": "Console Co",
                "source": "demo_console",
            },
        )
        _ok("Synthetic lead.created event emitted")
    except Exception as e:
        _fail(f"Broadcast failed: {e}")


async def generate_ai_post() -> None:
    """Hit Anthropic directly through the same client the Worker uses,
    so you can show the AI flow even if the queue + Worker plumbing is
    unhappy.
    """
    s = get_settings()
    if not s.anthropic_api_key:
        _fail("ANTHROPIC_API_KEY not set")
        return

    prompt = Prompt.ask(
        "Prompt",
        default="Write a 3-sentence LinkedIn post about agency operations.",
    ) if _HAS_RICH else input("Prompt: ") or "Write a LinkedIn post."

    async with httpx.AsyncClient(timeout=30.0) as c:
        r = await c.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": s.anthropic_api_key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json={
                "model": "claude-sonnet-4-6",
                "max_tokens": 400,
                "messages": [{"role": "user", "content": prompt}],
            },
        )
    if r.status_code != 200:
        _fail(f"Anthropic returned {r.status_code}: {r.text[:200]}")
        return
    data = r.json()
    text = data["content"][0]["text"] if data.get("content") else "(empty)"
    if _HAS_RICH:
        console.print(Panel(text, title="Generated", border_style="green"))
    else:
        console.print(text)


async def request_cf_stream_upload_url() -> None:
    """Get a one-time direct-upload URL for Cloudflare Stream so you can
    `curl` a real video into Stream from the terminal during the demo.
    """
    s = get_settings()
    if not (s.cf_account_id and s.cf_stream_api_token):
        _fail("CF_ACCOUNT_ID / CF_STREAM_API_TOKEN missing")
        return
    async with httpx.AsyncClient(timeout=10.0) as c:
        r = await c.post(
            f"https://api.cloudflare.com/client/v4/accounts/{s.cf_account_id}/stream/direct_upload",
            headers={"Authorization": f"Bearer {s.cf_stream_api_token}"},
            json={"maxDurationSeconds": 60, "creator": "demo-console"},
        )
    if r.status_code >= 400:
        _fail(f"Stream returned {r.status_code}: {r.text[:200]}")
        return
    res = r.json().get("result", {})
    upload_url = res.get("uploadURL")
    uid = res.get("uid")
    if _HAS_RICH:
        console.print(
            Panel(
                f"[bold]Upload URL:[/bold] {upload_url}\n\n"
                f"[bold]UID:[/bold] {uid}\n\n"
                f"[dim]Run:[/dim]\n"
                f"  curl -X POST '{upload_url}' -F file=@/path/to/video.mp4",
                title="Cloudflare Stream — direct upload",
                border_style="cyan",
            )
        )
    else:
        console.print(f"Upload URL: {upload_url}")
        console.print(f"UID: {uid}")


async def upload_test_image() -> None:
    """Pull a small public image and POST it to Cloudflare Images so you
    can prove the Images integration without leaving the terminal.
    """
    s = get_settings()
    if not (s.cf_account_id and s.cf_api_token):
        _fail("CF_ACCOUNT_ID / CF_API_TOKEN missing")
        return

    sample = "https://placehold.co/600x400.png"
    _info(f"Fetching sample image from {sample}")
    async with httpx.AsyncClient(timeout=15.0) as c:
        img = await c.get(sample)
        if img.status_code != 200:
            _fail(f"Sample fetch failed: {img.status_code}")
            return
        files = {"file": ("sample.png", img.content, "image/png")}
        r = await c.post(
            f"https://api.cloudflare.com/client/v4/accounts/{s.cf_account_id}/images/v1",
            headers={"Authorization": f"Bearer {s.cf_api_token}"},
            files=files,
        )
    if r.status_code != 200:
        _fail(f"Cloudflare Images returned {r.status_code}: {r.text[:200]}")
        return
    res = r.json().get("result", {})
    variants = res.get("variants", [])
    if _HAS_RICH:
        console.print(
            Panel(
                f"[bold]Image ID:[/bold] {res.get('id')}\n\n"
                f"[bold]Variants:[/bold]\n  " + "\n  ".join(variants),
                title="Cloudflare Images — uploaded",
                border_style="cyan",
            )
        )
    else:
        console.print(f"Image ID: {res.get('id')}")
        for v in variants:
            console.print(f"  variant: {v}")


# ── Main menu ────────────────────────────────────────────────────────


MENU: list[tuple[str, str, Callable[[], Awaitable[None]]]] = [
    ("1", "Run all integration checks", run_all_checks),
    ("2", "Fire fake Aurinko booking", fire_fake_aurinko_booking),
    ("3", "Trigger Stripe test payment + webhook", trigger_stripe_test_payment),
    ("4", "Send test email via our send pipeline", send_test_email),
    ("5", "Emit a synthetic SSE toast (lead.created)", emit_test_sse_event),
    ("6", "Generate AI content (Anthropic direct)", generate_ai_post),
    ("7", "Request a Cloudflare Stream upload URL", request_cf_stream_upload_url),
    ("8", "Upload a sample image to Cloudflare Images", upload_test_image),
]


def _render_menu() -> None:
    if _HAS_RICH:
        table = Table(title="Stevie demo console", show_header=False, pad_edge=False)
        table.add_column("key", style="cyan", no_wrap=True)
        table.add_column("action")
        for key, label, _ in MENU:
            table.add_row(key, label)
        table.add_row("q", "[red]quit[/red]")
        console.print(table)
    else:
        console.print("\nStevie demo console")
        for key, label, _ in MENU:
            console.print(f"  {key}. {label}")
        console.print("  q. quit\n")


async def _main_loop() -> None:
    while True:
        _render_menu()
        choice = (
            Prompt.ask("Choose")
            if _HAS_RICH
            else input("> ")
        ).strip().lower()
        if choice in ("q", "quit", "exit"):
            return
        for key, _label, fn in MENU:
            if key == choice:
                try:
                    await fn()
                except KeyboardInterrupt:
                    _info("Interrupted")
                except Exception as e:
                    _fail(f"Action failed: {e}")
                break
        else:
            _info(f"Unknown choice: {choice}")


def main() -> None:
    if not _HAS_RICH:
        print(
            "(install `rich` for a nicer UI: pip install rich)",
        )
    asyncio.run(_main_loop())


if __name__ == "__main__":
    main()
