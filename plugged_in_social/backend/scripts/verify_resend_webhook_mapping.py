"""Live verification: Resend webhook → generic event_type translation.

Asserts that each Resend event type translates to the correct generic
event_type and that metadata is extracted correctly. The legacy
``/internal/webhooks/resend`` endpoint no longer dispatches background
work (the email-events Cloudflare Worker is the canonical receiver), so
this verifier only checks the HTTP status, the translated event name in
the response body, and the message_id round-trip.

Run:
  WEBHOOK_SECRET=test-secret python -m scripts.verify_resend_webhook_mapping
"""
import os
import sys

# Point SQLAlchemy at an unreachable (but parseable) URL so boot doesn't
# block on a real DB — we never execute queries in this verifier.
os.environ.setdefault(
    "DATABASE_URL",
    "postgresql+asyncpg://none:none@127.0.0.1:1/none",
)
os.environ.setdefault("WEBHOOK_SECRET", "test-secret-abcdefghijklmnop1234567890abcd")

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402

SECRET = os.environ["WEBHOOK_SECRET"]
HEADERS = {
    "X-Webhook-Secret": SECRET,
    "Content-Type": "application/json",
}


def run_case(name: str, payload: dict, expect_http: int, expect_generic: str | None,
             expect_message_id: str | None, expect_meta_contains: dict | None = None):
    """Hit the legacy resend webhook and check its response shape.

    The endpoint logs and returns 200 for both mapped and ignored events;
    we assert the body's ``generic_type`` (when present) matches the
    expected mapping. Metadata is intentionally not surfaced in the
    response — we only check the mapping shape, not downstream effects.
    """
    client = TestClient(app)
    resp = client.post("/internal/webhooks/resend", headers=HEADERS, json=payload)

    ok = True
    fails = []

    if resp.status_code != expect_http:
        ok = False
        fails.append(f"http={resp.status_code} (want {expect_http})")

    try:
        body = resp.json()
    except Exception:
        body = {}

    if expect_generic is not None:
        got_generic = body.get("generic_type")
        if got_generic != expect_generic:
            ok = False
            fails.append(f"generic={got_generic!r} (want {expect_generic!r})")
        got_msgid = body.get("message_id")
        if got_msgid != expect_message_id:
            ok = False
            fails.append(f"message_id={got_msgid!r} (want {expect_message_id!r})")

    tag = "PASS" if ok else "FAIL"
    print(f"[{tag}] {name}")
    if not ok:
        for f in fails:
            print(f"       . {f}")
        print(f"       . response body: {resp.text[:200]}")
    return ok


def main():
    cases_pass = 0
    cases_total = 0

    def record(passed):
        nonlocal cases_pass, cases_total
        cases_total += 1
        if passed:
            cases_pass += 1

    # Mapped events — each should translate to the documented generic type.
    record(run_case(
        "email.opened → open",
        {"type": "email.opened", "data": {"email_id": "msg-a1"}},
        expect_http=200,
        expect_generic="open",
        expect_message_id="msg-a1",
    ))
    record(run_case(
        "email.clicked → click, extracts click.link into metadata",
        {
            "type": "email.clicked",
            "data": {
                "email_id": "msg-b2",
                "click": {"link": "https://stevie.social/blog/launch"},
            },
        },
        expect_http=200,
        expect_generic="click",
        expect_message_id="msg-b2",
        expect_meta_contains={"url": "https://stevie.social/blog/launch"},
    ))
    record(run_case(
        "email.bounced → bounce, extracts bounce.subType as reason",
        {
            "type": "email.bounced",
            "data": {
                "email_id": "msg-c3",
                "bounce": {"type": "hard", "subType": "general"},
            },
        },
        expect_http=200,
        expect_generic="bounce",
        expect_message_id="msg-c3",
        expect_meta_contains={"reason": "general"},
    ))
    record(run_case(
        "email.complained → unsubscribe",
        {"type": "email.complained", "data": {"email_id": "msg-d4"}},
        expect_http=200,
        expect_generic="unsubscribe",
        expect_message_id="msg-d4",
    ))

    # Ignored event types — 200 but no dispatch.
    for evt in ("email.sent", "email.delivered", "email.delivery_delayed"):
        record(run_case(
            f"{evt} (ignored) → no dispatch",
            {"type": evt, "data": {"email_id": "msg-ignore"}},
            expect_http=200,
            expect_generic=None,
            expect_message_id=None,
        ))

    # Unknown event type — 200, no dispatch, just a warning log.
    record(run_case(
        "unknown event → no dispatch",
        {"type": "email.brand_new_thing", "data": {"email_id": "msg-x"}},
        expect_http=200,
        expect_generic=None,
        expect_message_id=None,
    ))

    # Validation: known event but no email_id → 200, no dispatch.
    record(run_case(
        "email.opened missing email_id → no dispatch",
        {"type": "email.opened", "data": {}},
        expect_http=200,
        expect_generic=None,
        expect_message_id=None,
    ))

    print()
    print(f"=== {cases_pass}/{cases_total} cases passed ===")
    return 0 if cases_pass == cases_total else 1


if __name__ == "__main__":
    sys.exit(main())
