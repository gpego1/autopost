import base64
import logging
import time
from typing import Optional

import httpx
from cryptography.fernet import Fernet
from jose import JWTError, jwt

from app.core.config import settings

logger = logging.getLogger(__name__)

_jwks_cache: dict = {}
_jwks_cache_time: float = 0.0
_JWKS_TTL = 300.0  # refresh public keys every 5 minutes


def _get_fernet() -> Fernet:
    key = settings.encrypt_key
    try:
        decoded = base64.urlsafe_b64decode(key + "==")
        if len(decoded) != 32:
            raise ValueError("ENCRYPT_KEY must decode to exactly 32 bytes")
    except Exception as exc:
        raise RuntimeError(f"Invalid ENCRYPT_KEY: {exc}") from exc
    return Fernet(key.encode() if isinstance(key, str) else key)


def encrypt_token(token: str) -> bytes:
    f = _get_fernet()
    return f.encrypt(token.encode("utf-8"))


def decrypt_token(encrypted: bytes) -> str:
    f = _get_fernet()
    return f.decrypt(encrypted).decode("utf-8")


async def _get_jwks() -> dict:
    """Fetch Supabase JWKS (RS256 public keys) with a 5-minute in-memory cache."""
    global _jwks_cache, _jwks_cache_time
    now = time.monotonic()
    if _jwks_cache and (now - _jwks_cache_time) < _JWKS_TTL:
        return _jwks_cache

    url = f"{settings.supabase_url}/auth/v1/.well-known/jwks.json"
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        data = resp.json()

    _jwks_cache = data
    _jwks_cache_time = now
    logger.info("JWKS refreshed from %s (%d keys)", url, len(data.get("keys", [])))
    return _jwks_cache


async def verify_supabase_jwt(token: str) -> Optional[dict]:
    """
    Verify a Supabase JWT and return its payload.

    Modern Supabase projects sign with RS256 (asymmetric); the public keys are
    fetched from the JWKS endpoint. Older/custom projects use HS256 with the
    JWT secret. Both are tried in order.
    """
    # RS256 path — modern Supabase (post-2024 projects)
    try:
        jwks = await _get_jwks()
        payload = jwt.decode(
            token,
            jwks,
            algorithms=["RS256"],
            options={"verify_aud": False},
        )
        return payload
    except JWTError:
        pass  # fall through to HS256
    except Exception as exc:
        logger.warning("JWKS fetch/RS256 error: %s", exc)

    # HS256 fallback — legacy Supabase or custom JWT secret
    try:
        secret = settings.supabase_jwt_secret.strip()
        payload = jwt.decode(
            token,
            secret,
            algorithms=["HS256"],
            options={"verify_aud": False},
        )
        return payload
    except JWTError as exc:
        logger.warning("JWT verification failed: %s", exc)
        return None


def extract_user_id(payload: dict) -> Optional[str]:
    return payload.get("sub")
