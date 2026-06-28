"""``MediaAsset.delivery_url`` resolves to real https:// URLs.

Regression: the old implementation returned ``cf-images://<id>`` which
no <img> tag could render — uploaded logos appeared broken on the
public portal even though the upload succeeded.
"""
from __future__ import annotations

import pytest

from app.core.config import get_settings
from app.models.media_asset import MediaAsset


def _make_asset(**overrides) -> MediaAsset:
    asset = MediaAsset(
        org_id="00000000-0000-0000-0000-000000000000",
        asset_type="image",
        storage_backend="cf_images",
        filename="logo.png",
        mime_type="image/png",
    )
    for k, v in overrides.items():
        setattr(asset, k, v)
    return asset


@pytest.fixture(autouse=True)
def _clear_settings_cache():
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def test_cf_image_returns_imagedelivery_url(monkeypatch):
    monkeypatch.setenv("CF_IMAGES_ACCOUNT_HASH", "abc123hash")
    monkeypatch.delenv("CF_IMAGES_DELIVERY_URL", raising=False)
    get_settings.cache_clear()

    asset = _make_asset(cf_image_id="img-uuid-1")
    assert asset.delivery_url == (
        "https://imagedelivery.net/abc123hash/img-uuid-1/public"
    )


def test_cf_image_prefers_explicit_delivery_url(monkeypatch):
    monkeypatch.setenv(
        "CF_IMAGES_DELIVERY_URL", "https://cdn.example.com/imgs"
    )
    monkeypatch.setenv("CF_IMAGES_ACCOUNT_HASH", "abc123hash")
    get_settings.cache_clear()

    asset = _make_asset(cf_image_id="img-uuid-2")
    assert asset.delivery_url == "https://cdn.example.com/imgs/img-uuid-2/public"


def test_cf_image_returns_none_when_unconfigured(monkeypatch):
    monkeypatch.delenv("CF_IMAGES_ACCOUNT_HASH", raising=False)
    monkeypatch.delenv("CF_IMAGES_DELIVERY_URL", raising=False)
    get_settings.cache_clear()

    asset = _make_asset(cf_image_id="img-uuid-3")
    # Old code would have returned ``cf-images://img-uuid-3`` here —
    # which broke the <img> tag silently. New code surfaces None so the
    # frontend can show an upload error instead.
    assert asset.delivery_url is None


def test_r2_returns_explicit_r2_url():
    asset = MediaAsset(
        org_id="00000000-0000-0000-0000-000000000000",
        asset_type="document",
        storage_backend="r2",
        filename="brief.pdf",
        mime_type="application/pdf",
        r2_url="https://r2.example.com/brief.pdf",
    )
    assert asset.delivery_url == "https://r2.example.com/brief.pdf"


def test_r2_derives_url_from_key_and_public_url(monkeypatch):
    """Regression: ``request_upload`` only stores ``r2_key`` — the public
    URL must be derived. Without this, blog cover / logo uploads via R2
    fail with "no delivery URL" even when R2_PUBLIC_URL is configured."""
    monkeypatch.setenv("R2_PUBLIC_URL", "https://cdn.example.com")
    get_settings.cache_clear()

    asset = MediaAsset(
        org_id="00000000-0000-0000-0000-000000000000",
        asset_type="image",
        storage_backend="r2",
        filename="logo.png",
        mime_type="image/png",
        r2_key="org-slug/logo/2026/05/logo.png",
    )
    assert (
        asset.delivery_url
        == "https://cdn.example.com/org-slug/logo/2026/05/logo.png"
    )


def test_r2_strips_leading_slash_from_key(monkeypatch):
    """Defensive: r2_key is conventionally unslashed but an extra
    leading slash shouldn't produce a malformed URL with a double slash."""
    monkeypatch.setenv("R2_PUBLIC_URL", "https://cdn.example.com/")
    get_settings.cache_clear()

    asset = MediaAsset(
        org_id="00000000-0000-0000-0000-000000000000",
        asset_type="image",
        storage_backend="r2",
        filename="logo.png",
        mime_type="image/png",
        r2_key="/org-slug/logo.png",
    )
    assert asset.delivery_url == "https://cdn.example.com/org-slug/logo.png"


def test_r2_returns_none_when_neither_url_nor_public_base(monkeypatch):
    monkeypatch.delenv("R2_PUBLIC_URL", raising=False)
    get_settings.cache_clear()

    asset = MediaAsset(
        org_id="00000000-0000-0000-0000-000000000000",
        asset_type="image",
        storage_backend="r2",
        filename="logo.png",
        mime_type="image/png",
        r2_key="org-slug/logo.png",
    )
    assert asset.delivery_url is None


def test_r2_explicit_url_wins_over_derivation(monkeypatch):
    """If a flow has populated r2_url explicitly, prefer it — even if
    R2_PUBLIC_URL points elsewhere. Useful for backfilled rows."""
    monkeypatch.setenv("R2_PUBLIC_URL", "https://cdn.example.com")
    get_settings.cache_clear()

    asset = MediaAsset(
        org_id="00000000-0000-0000-0000-000000000000",
        asset_type="image",
        storage_backend="r2",
        filename="logo.png",
        mime_type="image/png",
        r2_url="https://legacy-cdn.example.com/logo.png",
        r2_key="org-slug/logo.png",
    )
    assert asset.delivery_url == "https://legacy-cdn.example.com/logo.png"
