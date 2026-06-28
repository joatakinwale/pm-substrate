"""Page model — CMS page content with structured JSONB blocks."""
import enum
import uuid

from sqlalchemy import ForeignKey, Integer, String, Text, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, OrgMixin, TimestampMixin


class PageStatus(str, enum.Enum):
    """Page publication states."""
    DRAFT = "draft"
    PUBLISHED = "published"
    ARCHIVED = "archived"


class Page(TimestampMixin, OrgMixin, Base):
    """
    CMS pages with structured content blocks (JSONB).

    Content is stored as an ordered array of blocks:
    [
      {"type": "hero", "headline": "Social that speaks.", "subline": "..."},
      {"type": "stats_bar", "items": [{"label": "Revenue", "value": "$350K"}]},
      {"type": "services", "items": [...]},
      {"type": "testimonials", "items": [...]},
    ]

    Supports optimistic locking via `version` column and
    soft deletes via `is_deleted`.
    """

    __tablename__ = "pages"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id"),
        nullable=False,
    )

    slug: Mapped[str] = mapped_column(
        String(255), nullable=False, index=True,
        comment="URL path segment, e.g. 'about', 'portfolio'",
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)

    # Structured content blocks
    content: Mapped[dict] = mapped_column(
        JSONB, server_default=text("'[]'::jsonb"), nullable=False,
        comment="Ordered array of content blocks",
    )

    # SEO
    meta_title: Mapped[str | None] = mapped_column(String(255), nullable=True)
    meta_description: Mapped[str | None] = mapped_column(Text, nullable=True)
    og_image_url: Mapped[str | None] = mapped_column(Text, nullable=True)

    status: Mapped[str] = mapped_column(
        String(20), default=PageStatus.DRAFT.value, nullable=False,
    )

    # Optimistic locking
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)

    # Soft delete
    is_deleted: Mapped[bool] = mapped_column(default=False, nullable=False)

    # Who last edited
    last_edited_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=True,
    )

    __table_args__ = (
        UniqueConstraint("org_id", "slug", name="uq_pages_org_slug"),
    )

    def __repr__(self) -> str:
        return f"<Page {self.slug} v{self.version} ({self.status})>"
