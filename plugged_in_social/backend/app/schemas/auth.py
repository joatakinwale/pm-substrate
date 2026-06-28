"""Auth request/response schemas."""
import uuid

from pydantic import BaseModel, EmailStr, Field


# ── Registration ──────────────────────────────────────────

class RegisterRequest(BaseModel):
    """First user creates an org + user in one shot."""
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: str = Field(min_length=1, max_length=255)
    org_name: str = Field(min_length=1, max_length=255)
    org_slug: str = Field(min_length=2, max_length=100, pattern=r"^[a-z0-9\-]+$")


class InviteAcceptRequest(BaseModel):
    """Accepting an invite to an existing org."""
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: str = Field(min_length=1, max_length=255)
    invite_token: str


# ── Login ─────────────────────────────────────────────────

class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


# ── User info ─────────────────────────────────────────────

class UserResponse(BaseModel):
    id: uuid.UUID
    org_id: uuid.UUID
    email: str
    full_name: str
    role: str
    avatar_url: str | None = None
    is_active: bool

    model_config = {"from_attributes": True}


class MeResponse(BaseModel):
    user: UserResponse
    org_name: str
    org_slug: str
