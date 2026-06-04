import base64
import logging
from typing import Optional

from cryptography.fernet import Fernet
from jose import JWTError, jwt

from app.core.config import settings

logger = logging.getLogger(__name__)


def _get_fernet() -> Fernet:
    """Return a Fernet instance using the configured ENCRYPT_KEY."""
    key = settings.encrypt_key
    # Ensure key is valid base64 and 32 bytes when decoded
    try:
        decoded = base64.urlsafe_b64decode(key + "==")
        if len(decoded) != 32:
            raise ValueError("ENCRYPT_KEY must decode to exactly 32 bytes")
    except Exception as exc:
        raise RuntimeError(f"Invalid ENCRYPT_KEY: {exc}") from exc
    return Fernet(key.encode() if isinstance(key, str) else key)


def encrypt_token(token: str) -> bytes:
    """Encrypt a plaintext OAuth token for storage."""
    f = _get_fernet()
    return f.encrypt(token.encode("utf-8"))


def decrypt_token(encrypted: bytes) -> str:
    """Decrypt a stored OAuth token."""
    f = _get_fernet()
    return f.decrypt(encrypted).decode("utf-8")


def verify_supabase_jwt(token: str) -> Optional[dict]:
    """
    Verify a Supabase-issued JWT and return its payload.
    Returns None if the token is invalid or expired.
    """
    try:
        payload = jwt.decode(
            token,
            settings.supabase_jwt_secret,
            algorithms=["HS256"],
            options={"verify_aud": False},
        )
        return payload
    except JWTError as exc:
        logger.warning("JWT verification failed: %s", exc)
        return None


def extract_user_id(payload: dict) -> Optional[str]:
    """Extract the user UUID from a verified JWT payload."""
    return payload.get("sub")
