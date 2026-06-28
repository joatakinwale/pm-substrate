"""Stripe billing service — wraps Stripe API for Stevie Social.

Handles customer creation, invoice management, subscription lifecycle,
and customer portal sessions. All amounts are in cents.
"""
import hashlib
import stripe
from app.core.config import get_settings


def _configure() -> None:
    """Set Stripe API key from settings."""
    settings = get_settings()
    stripe.api_key = settings.stripe_secret_key


# ═══════════════════════════════════
# Customers
# ═══════════════════════════════════

def _customer_idempotency_key(email: str, org_id: str | None) -> str:
    """Deterministic idempotency key for customer creation.

    Stripe keeps the key -> response mapping for ~24 hours. Two concurrent
    requests with the same key see the exact same Customer object returned
    — no duplicate is created. Scoping by ``org_id`` lets two different
    Stevie orgs legitimately create their own Stripe customer for the same
    end-user email.
    """
    raw = f"{org_id or 'no-org'}|{email.strip().lower()}"
    digest = hashlib.sha256(raw.encode()).hexdigest()[:32]
    return f"stevie:customer:{digest}"


def create_customer(
    email: str,
    name: str | None = None,
    metadata: dict | None = None,
    *,
    idempotency_key: str | None = None,
) -> stripe.Customer:
    """Create a Stripe customer.

    Pass ``idempotency_key`` to make retries safe — two calls with the same
    key return the same Customer. ``get_or_create_customer`` derives one
    automatically from the email + org_id.
    """
    _configure()
    kwargs: dict = {}
    if idempotency_key:
        kwargs["idempotency_key"] = idempotency_key
    return stripe.Customer.create(
        email=email,
        name=name,
        metadata=metadata or {},
        **kwargs,
    )


def get_customer(customer_id: str) -> stripe.Customer:
    _configure()
    return stripe.Customer.retrieve(customer_id)


def get_or_create_customer(
    email: str,
    name: str | None = None,
    metadata: dict | None = None,
) -> stripe.Customer:
    """Find existing customer by email, or create new one.

    Race-safe (MED-4)
    -----------------
    The previous implementation did a list-then-create with no lock, so two
    concurrent requests for the same email would both see an empty list
    and both would hit ``Customer.create``, producing duplicate customers
    in Stripe.

    This version still does the cheap ``Customer.list`` lookup (by far the
    hot path — the customer almost always already exists), but the
    ``create`` path now passes a deterministic Stripe *idempotency key*
    derived from the email + ``metadata.org_id``. Stripe deduplicates
    concurrent creates server-side: both racers receive the same Customer.
    """
    _configure()

    # Fast path: already exists.
    existing = stripe.Customer.list(email=email, limit=1)
    if existing.data:
        return existing.data[0]

    # Slow path: create with an idempotency key so concurrent racers resolve
    # to the same Customer rather than producing duplicates.
    org_id = (metadata or {}).get("org_id") if metadata else None
    key = _customer_idempotency_key(email, org_id)
    return create_customer(
        email=email,
        name=name,
        metadata=metadata,
        idempotency_key=key,
    )


# ═══════════════════════════════════
# Invoices
# ═══════════════════════════════════

def create_invoice(
    customer_id: str,
    line_items: list[dict],
    description: str | None = None,
    due_days: int = 30,
    metadata: dict | None = None,
) -> stripe.Invoice:
    """Create a one-off invoice with line items.

    line_items format: [{"description": "...", "amount_cents": 500000, "quantity": 1}]
    """
    _configure()

    # Create invoice
    inv = stripe.Invoice.create(
        customer=customer_id,
        collection_method="send_invoice",
        days_until_due=due_days,
        description=description,
        metadata=metadata or {},
    )

    # Add line items
    for item in line_items:
        stripe.InvoiceItem.create(
            customer=customer_id,
            invoice=inv.id,
            amount=item["amount_cents"],
            currency="usd",
            description=item.get("description", ""),
            quantity=item.get("quantity", 1),
        )

    return inv


def finalize_invoice(invoice_id: str) -> stripe.Invoice:
    """Finalize a draft invoice (makes it sendable)."""
    _configure()
    return stripe.Invoice.finalize_invoice(invoice_id)


def send_invoice(invoice_id: str) -> stripe.Invoice:
    """Send a finalized invoice to the customer."""
    _configure()
    return stripe.Invoice.send_invoice(invoice_id)


def void_invoice(invoice_id: str) -> stripe.Invoice:
    _configure()
    return stripe.Invoice.void_invoice(invoice_id)


def get_invoice(invoice_id: str) -> stripe.Invoice:
    _configure()
    return stripe.Invoice.retrieve(invoice_id, expand=["payment_intent"])


def list_invoices(
    customer_id: str | None = None,
    status: str | None = None,
    limit: int = 25,
) -> list[stripe.Invoice]:
    _configure()
    params: dict = {"limit": limit}
    if customer_id:
        params["customer"] = customer_id
    if status:
        params["status"] = status
    return stripe.Invoice.list(**params).data


# ═══════════════════════════════════
# Subscriptions
# ═══════════════════════════════════

def create_subscription(
    customer_id: str,
    price_id: str,
    metadata: dict | None = None,
    trial_days: int | None = None,
) -> stripe.Subscription:
    """Create a recurring subscription."""
    _configure()
    params: dict = {
        "customer": customer_id,
        "items": [{"price": price_id}],
        "metadata": metadata or {},
        "payment_behavior": "default_incomplete",
        "expand": ["latest_invoice.payment_intent"],
    }
    if trial_days:
        params["trial_period_days"] = trial_days
    return stripe.Subscription.create(**params)


def cancel_subscription(
    subscription_id: str,
    at_period_end: bool = True,
) -> stripe.Subscription:
    """Cancel a subscription (immediately or at period end)."""
    _configure()
    if at_period_end:
        return stripe.Subscription.modify(
            subscription_id,
            cancel_at_period_end=True,
        )
    return stripe.Subscription.cancel(subscription_id)


def update_subscription(
    subscription_id: str,
    price_id: str | None = None,
    metadata: dict | None = None,
    *,
    proration_behavior: str = "create_prorations",
) -> stripe.Subscription:
    """Update a subscription's price and/or metadata.

    STRIPE-6 FIX — ``proration_behavior`` is now explicit
    -----------------------------------------------------
    Stripe's server-side default for ``Subscription.modify`` is
    ``create_prorations`` today, but (a) Stripe has changed defaults on
    other fields without notice in the past and (b) the callers here
    absolutely rely on prorations being generated — without them, an
    upgrade mid-cycle would silently give the customer the higher plan
    at the lower plan's price for the remainder of the period, and a
    downgrade would leave us holding unearned revenue. Making it
    explicit defends against that class of bug and documents the
    intent at the call site.

    Acceptable values (mirrors Stripe's API enum):
      - ``"create_prorations"`` (default) — generate proration line
        items on the next invoice. This is what almost every caller
        wants for a real price change.
      - ``"none"`` — no proration; the new price takes effect at the
        next billing cycle. Use for ``metadata``-only updates or when
        doing a separate credit.
      - ``"always_invoice"`` — generate an immediate invoice for the
        proration rather than waiting for the next cycle. Reserved for
        mid-cycle upgrades where we want to collect now.
    """
    _configure()
    params: dict = {}
    if price_id:
        sub = stripe.Subscription.retrieve(subscription_id)
        params["items"] = [
            {
                "id": sub["items"]["data"][0]["id"],
                "price": price_id,
            }
        ]
        # Only include proration_behavior when we actually change the
        # price — sending it on a metadata-only update is harmless but
        # noisy in Stripe event logs.
        params["proration_behavior"] = proration_behavior
    if metadata is not None:
        params["metadata"] = metadata
    return stripe.Subscription.modify(subscription_id, **params)


def get_subscription(subscription_id: str) -> stripe.Subscription:
    _configure()
    return stripe.Subscription.retrieve(
        subscription_id,
        expand=["latest_invoice"],
    )


# ═══════════════════════════════════
# Customer Portal
# ═══════════════════════════════════

def create_portal_session(
    customer_id: str,
    return_url: str,
) -> stripe.billing_portal.Session:
    """Create a Stripe Customer Portal session for self-service billing."""
    _configure()
    return stripe.billing_portal.Session.create(
        customer=customer_id,
        return_url=return_url,
    )


# ═══════════════════════════════════
# Webhook verification
# ═══════════════════════════════════

def construct_webhook_event(
    payload: bytes,
    sig_header: str,
) -> stripe.Event:
    """Verify and construct a Stripe webhook event."""
    settings = get_settings()
    return stripe.Webhook.construct_event(
        payload,
        sig_header,
        settings.stripe_webhook_secret,
    )
