"""JWT token creation and verification."""
from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt

from app.core.config import get_settings


def create_access_token(
    data: dict,
    expires_delta: timedelta | None = None,
) -> str:
    """Create a signed JWT access token.

    Payload includes:
      - sub: user_id (UUID as string)
      - org_id: organization UUID
      - role: user role string
      - exp: expiration timestamp
    """
    settings = get_settings()
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta
        or timedelta(minutes=settings.jwt_access_token_expire_minutes)
    )
    to_encode["exp"] = expire
    to_encode["type"] = "access"
    return jwt.encode(
        to_encode,
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
    )


def create_refresh_token(data: dict) -> str:
    """Create a longer-lived refresh token."""
    settings = get_settings()
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(
        days=settings.jwt_refresh_token_expire_days
    )
    to_encode["exp"] = expire
    to_encode["type"] = "refresh"
    return jwt.encode(
        to_encode,
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
    )


def decode_token(token: str) -> dict | None:
    """Decode and validate a JWT. Returns payload or None if invalid."""
    settings = get_settings()
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret_key,
            algorithms=[settings.jwt_algorithm],
        )
        return payload
    except JWTError:
        return None
