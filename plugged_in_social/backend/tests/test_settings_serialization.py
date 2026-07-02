"""Public-branding response shape — guarantees no secrets leak.

The ``/api/public/branding/{slug}`` endpoint is unauthenticated, so the
response model must explicitly include only public-safe fields. This
test pins the shape so a future ``settings`` JSONB key (e.g. an Umami
api_key, an internal feature flag) can't accidentally be added to the
response.
"""
from __future__ import annotations

from app.api.settings import PublicBrandingResponse


def test_public_branding_fields_are_safelisted():
    expected = {
        "slug",
        "name",
        "logo_url",
        "primary_color",
        "accent_color",
        "dashboard_intro",
        "booking_profile_slug",
        "umami_website_id",
    }
    assert set(PublicBrandingResponse.model_fields.keys()) == expected


def test_public_branding_excludes_umami_api_key():
    """The Umami API key is intentionally NOT exposed publicly. If a
    future refactor pulls it in by accident this test fails loudly."""
    assert "umami_api_key" not in PublicBrandingResponse.model_fields
    assert "api_key" not in PublicBrandingResponse.model_fields


def test_public_branding_excludes_email_addresses():
    """Email From / Reply-To are also kept off the public surface — they
    might be a real human's inbox and we don't want to expose those to
    anonymous visitors."""
    assert "email_from" not in PublicBrandingResponse.model_fields
    assert "email_reply_to" not in PublicBrandingResponse.model_fields
