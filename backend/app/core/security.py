import base64
import logging
import time
from typing import Optional

import httpx
from cryptography.fernet import Fernet
from jose import JWTError, jwk, jwt

from app.core.config import settings

logger = logging.getLogger(__name__)

# kid → jose Key object, refreshed every 5 minutes
_rsa_keys: dict = {}
_rsa_keys_time: float = 0.0
_JWKS_TTL = 300.0


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


async def _refresh_rsa_keys() -> dict:
    """Fetch Supabase JWKS and build an explicit kid → jose Key map."""
    global _rsa_keys, _rsa_keys_time
    now = time.monotonic()
    if _rsa_keys and (now - _rsa_keys_time) < _JWKS_TTL:
        return _rsa_keys

    url = f"{settings.supabase_url}/auth/v1/.well-known/jwks.json"
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        data = resp.json()

    new_keys: dict = {}
    for key_data in data.get("keys", []):
        try:
            kid = key_data.get("kid", "__default__")
            new_keys[kid] = jwk.construct(key_data, algorithm="RS256")
            logger.info("JWKS key loaded: kid=%s", kid)
        except Exception as exc:
            logger.warning("Failed to load JWKS key kid=%s: %s", key_data.get("kid"), exc)

    _rsa_keys = new_keys
    _rsa_keys_time = now
    logger.info("JWKS refreshed — %d key(s) available", len(new_keys))
    return new_keys


async def verify_supabase_jwt(token: str) -> Optional[dict]:
    """
    Verify a Supabase JWT.
    - RS256 path: fetches public keys from Supabase JWKS, matches by kid.
    - HS256 path: falls back to SUPABASE_JWT_SECRET (legacy / custom projects).
    Logs the algorithm at INFO so it is visible in Vercel production logs.
    """
    try:
        header = jwt.get_unverified_header(token)
        alg = header.get("alg", "unknown")
        kid = header.get("kid")
        logger.info("JWT incoming: alg=%s kid=%s", alg, kid)
    except Exception as exc:
        logger.warning("Cannot parse JWT header: %s", exc)
        return None

    if alg == "RS256":
        try:
            keys = await _refresh_rsa_keys()
            rsa_key = keys.get(kid) if kid else None
            if rsa_key is None and keys:
                # No kid or no match — try any available key
                rsa_key = next(iter(keys.values()))
            if rsa_key is None:
                logger.warning("RS256: no JWKS key available (JWKS empty or fetch failed)")
                return None

            payload = jwt.decode(
                token,
                rsa_key,
                algorithms=["RS256"],
                options={"verify_aud": False},
            )
            return payload
        except JWTError as exc:
            logger.warning("RS256 JWT verification failed: %s", exc)
            return None
        except Exception as exc:
            logger.warning("RS256 verification error: %s", exc)
            return None

    # HS256 path (older / custom Supabase projects)
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
