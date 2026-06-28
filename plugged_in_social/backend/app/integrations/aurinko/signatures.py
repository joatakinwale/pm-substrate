"""Aurinko webhook signature verification.

Aurinko signs every webhook POST with an HMAC-SHA256 over the raw
request body using the application's signing secret. The signature
arrives in the ``X-Aurinko-Signature`` header. Subscription creation
also performs a one-time URL verification handshake — Aurinko POSTs a
token that the endpoint must echo back.
"""
from __future__ import annotations

import hashlib
import hmac
import logging

from app.core.config import get_settings

logger = logging.getLogger(__name__)

SIGNATURE_HEADER = "X-Aurinko-Signature"
VALIDATION_TOKEN_HEADER = "X-Aurinko-Request-Validation-Token"


def verify_webhook_signature(*, raw_body: bytes, signature_header: str | None) -> bool:
    """Return True iff the HMAC-SHA256 of ``raw_body`` matches the header.

    Constant-time comparison via ``hmac.compare_digest`` to avoid
    timing leaks. Returns False when the signing secret isn't
    configured — the endpoint should reject in that case rather than
    silently accept unsigned payloads.
    """
    settings = get_settings()
    if not settings.aurinko_signing_secret:
        logger.error(
            "aurinko_webhook_signature_unconfigured — refusing to verify"
        )
        return False
    if not signature_header:
        return False

    expected = hmac.new(
        settings.aurinko_signing_secret.encode("utf-8"),
        raw_body,
        hashlib.sha256,
    ).hexdigest()
    # Aurinko sends the signature as a hex string. Some providers wrap
    # in ``sha256=...``; tolerate that prefix.
    candidate = signature_header.strip()
    if candidate.startswith("sha256="):
        candidate = candidate[len("sha256=") :]
    return hmac.compare_digest(expected, candidate)
