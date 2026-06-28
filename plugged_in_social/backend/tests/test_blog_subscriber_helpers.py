from datetime import datetime, timezone

from app.api.blog import _blog_subscription_metadata, _merge_unique_tags


def test_merge_unique_tags_preserves_existing_order() -> None:
    assert _merge_unique_tags(
        ["customer", "blog-subscriber"],
        ["blog-subscriber", "blog-launch"],
    ) == ["customer", "blog-subscriber", "blog-launch"]


def test_blog_subscription_metadata_preserves_first_opt_in() -> None:
    first = "2026-05-01T12:00:00+00:00"
    now = datetime(2026, 5, 16, 17, 30, tzinfo=timezone.utc)

    metadata = _blog_subscription_metadata(
        {
            "source": "manual",
            "blog_subscription": {"first_opt_in_at": first},
        },
        org_slug="stevie-social",
        now=now,
    )

    assert metadata["source"] == "manual"
    assert metadata["blog_subscription"] == {
        "first_opt_in_at": first,
        "last_opt_in_at": "2026-05-16T17:30:00+00:00",
        "org_slug": "stevie-social",
        "source": "blog_page",
    }
