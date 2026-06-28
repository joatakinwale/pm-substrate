"""Shared response schemas used across multiple routers."""
import uuid
from datetime import datetime
from typing import Any

from fastapi import HTTPException
from pydantic import BaseModel


class OkResponse(BaseModel):
    ok: bool = True
    message: str = "Success"


def version_conflict(
    *,
    resource: str,
    current_version: int,
    attempted_version: int,
    current: Any,
) -> HTTPException:
    """Build a structured 409 for optimistic-locking collisions.

    The client side (see frontend/src/lib/api.ts) parses this shape into
    a ConflictError so the UI can show the live server state alongside
    the user's pending edits and let them resolve the conflict.

    ``current`` should be the ready-to-serialize object (a Pydantic model
    instance, a model_dump(), or a plain dict) representing the latest
    server-side state at the moment of the collision.
    """
    # Accept Pydantic v2 model instances too — serialize to JSON-safe dict
    if hasattr(current, "model_dump"):
        current_payload: Any = current.model_dump(mode="json")
    else:
        current_payload = current

    return HTTPException(
        status_code=409,
        detail={
            "code": "version_conflict",
            "resource": resource,
            "message": (
                f"This {resource} was updated by someone else while you were editing "
                f"(server is at v{current_version}, you sent v{attempted_version}). "
                "Review their changes before saving."
            ),
            "current_version": current_version,
            "attempted_version": attempted_version,
            "current": current_payload,
        },
    )


class PaginatedParams(BaseModel):
    """Standard pagination query parameters."""
    page: int = 1
    per_page: int = 25

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.per_page

    @property
    def limit(self) -> int:
        return self.per_page


class PaginatedResponse(BaseModel):
    """Wraps a list response with pagination metadata."""
    items: list
    total: int
    page: int
    per_page: int
    pages: int
