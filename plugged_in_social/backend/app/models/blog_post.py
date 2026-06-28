"""Blog post model — CMS blog with rich text, categories, and tags."""
import enum
import uuid
from datetime import datetime

from sqlalchemy import ForeignKey, Integer, String, Text, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, OrgMixin, TimestampMixin


class PostStatus(str, enum.Enum):
    """Blog post publication states."""
    DRAFT = "draft"
    PUBLISHED = "published"
    SCHEDULED = "scheduled"
    ARCHIVED = "archived"


class BlogPost(TimestampMixin, OrgMixin, Base):
    """
    Blog posts with rich text body (TipTap HTML), categories,
    tags, and SEO fields. Supports scheduling and soft deletes.
    """

    __tablename__ = "blog_posts"

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
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)

    # Rich text content (TipTap HTML output)
    body: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Excerpt for previews/cards
    excerpt: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Categorization
    category: Mapped[str | None] = mapped_column(
        String(100), nullable=True, index=True,
    )
    tags: Mapped[list | None] = mapped_column(
        ARRAY(String(100)), server_default=text("'{}'"), nullable=False,
    )

    # Cover image
    cover_image_url: Mapped[str | None] = mapped_column(Text, nullable=True)

    # SEO
    meta_title: Mapped[str | None] = mapped_column(String(255), nullable=True)
    meta_description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Status and scheduling
    status: Mapped[str] = mapped_column(
        String(20), default=PostStatus.DRAFT.value, nullable=False,
    )
    published_at: Mapped[datetime | None] = mapped_column(nullable=True, index=True)
    scheduled_for: Mapped[datetime | None] = mapped_column(nullable=True)

    # Author
    author_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=True,
        index=True,
    )

    # Optimistic locking
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)

    # Soft delete
    is_deleted: Mapped[bool] = mapped_column(default=False, nullable=False)

    # Reading time estimate (computed on save)
    reading_time_minutes: Mapped[int | None] = mapped_column(nullable=True)

    __table_args__ = (
        UniqueConstraint("org_id", "slug", name="uq_blog_posts_org_slug"),
    )

    def __repr__(self) -> str:
        return f"<BlogPost '{self.title}' ({self.status})>"
