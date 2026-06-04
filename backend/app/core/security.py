import base64
import hashlib
import hmac
import json
import logging
import time
from typing import Optional

import httpx
from cryptography.exceptions import InvalidSignature
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives.asymmetric.padding import PKCS1v15
from cryptography.hazmat.primitives.asymmetric.rsa import RSAPublicNumbers
from cryptography.hazmat.primitives.hashes import SHA256

from app.core.config import settings

logger = logging.getLogger(__name__)

# kid → RSAPublicKey; refreshed every 5 minutes
_rsa_keys: dict = {}
_rsa_keys_time: float = 0.0
_JWKS_TTL = 300.0


# ── Fernet helpers ────────────────────────────────────────────────────────────

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
    return _get_fernet().encrypt(token.encode("utf-8"))


def decrypt_token(encrypted: bytes) -> str:
    return _get_fernet().decrypt(encrypted).decode("utf-8")


# ── JWT helpers ───────────────────────────────────────────────────────────────

def _b64url_decode(s: str) -> bytes:
    s += "=" * (-len(s) % 4)
    return base64.urlsafe_b64decode(s)


def _jwt_parts(token: str):
    """Split token into (header_dict, payload_dict, signing_input_bytes, sig_bytes)."""
    parts = token.split(".")
    if len(parts) != 3:
        raise ValueError("JWT must have exactly 3 parts")
    header = json.loads(_b64url_decode(parts[0]))
    payload = json.loads(_b64url_decode(parts[1]))
    signing_input = f"{parts[0]}.{parts[1]}".encode("ascii")
    signature = _b64url_decode(parts[2])
    return header, payload, signing_input, signature


# ── JWKS / RSA ────────────────────────────────────────────────────────────────

async def _refresh_rsa_keys() -> dict:
    """Fetch Supabase JWKS and build a kid → RSAPublicKey map."""
    global _rsa_keys, _rsa_keys_time
    now = time.monotonic()
    if _rsa_keys and (now - _rsa_keys_time) < _JWKS_TTL:
        return _rsa_keys

    url = f"{settings.supabase_url}/auth/v1/.well-known/jwks.json"
    logger.info("Fetching JWKS from %s", url)
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        data = resp.json()

    new_keys: dict = {}
    for key_data in data.get("keys", []):
        try:
            if key_data.get("kty") != "RSA":
                continue
            kid = key_data.get("kid", "__default__")
            n = int.from_bytes(_b64url_decode(key_data["n"]), "big")
            e = int.from_bytes(_b64url_decode(key_data["e"]), "big")
            new_keys[kid] = RSAPublicNumbers(e=e, n=n).public_key()
            logger.info("RSA public key loaded: kid=%s", kid)
        except Exception as exc:
            logger.warning("Skipping bad JWKS key (kid=%s): %s", key_data.get("kid"), exc)

    _rsa_keys = new_keys
    _rsa_keys_time = now
    logger.info("JWKS refreshed — %d RSA key(s) loaded", len(new_keys))
    return new_keys


def _verify_rs256(signing_input: bytes, signature: bytes, rsa_key) -> None:
    """Raise InvalidSignature if the RS256 signature is wrong."""
    rsa_key.verify(signature, signing_input, PKCS1v15(), SHA256())


def _verify_hs256(signing_input: bytes, signature: bytes, secret: str) -> None:
    """Raise ValueError if the HS256 signature is wrong."""
    expected = hmac.new(secret.encode("utf-8"), signing_input, hashlib.sha256).digest()
    if not hmac.compare_digest(signature, expected):
        raise ValueError("HS256 signature mismatch")


# ── Public API ────────────────────────────────────────────────────────────────

async def verify_supabase_jwt(token: str) -> Optional[dict]:
    """
    Verify a Supabase JWT using the cryptography library directly.

    RS256 path: fetches public keys from Supabase JWKS endpoint and verifies
    with PKCS1v15 + SHA-256. Matched by kid header; falls back to any key if
    no kid is present.

    HS256 path: verifies with SUPABASE_JWT_SECRET (legacy / custom projects).

    Logs alg and kid at INFO level for production diagnostics.
    """
    try:
        header, payload, signing_input, signature = _jwt_parts(token)
    except Exception as exc:
        logger.warning("Cannot parse JWT: %s", exc)
        return None

    alg = header.get("alg", "unknown")
    kid = header.get("kid")
    logger.info("JWT: alg=%s kid=%s", alg, kid)

    # Check expiry
    exp = payload.get("exp")
    if exp and time.time() > exp:
        logger.warning("JWT expired")
        return None

    if alg == "RS256":
        try:
            keys = await _refresh_rsa_keys()
            rsa_key = keys.get(kid) if kid else None
            if rsa_key is None and keys:
                rsa_key = next(iter(keys.values()))
            if rsa_key is None:
                logger.warning("RS256: JWKS returned no usable RSA keys")
                return None
            _verify_rs256(signing_input, signature, rsa_key)
            logger.info("RS256 verification OK for sub=%s", payload.get("sub"))
            return payload
        except InvalidSignature:
            logger.warning("RS256 signature invalid (wrong key or tampered token)")
            return None
        except Exception as exc:
            logger.warning("RS256 verification error: %s", exc)
            return None

    if alg == "HS256":
        try:
            secret = settings.supabase_jwt_secret.strip()
            _verify_hs256(signing_input, signature, secret)
            return payload
        except Exception as exc:
            logger.warning("HS256 JWT verification failed: %s", exc)
            return None

    logger.warning("Unsupported JWT algorithm: %s", alg)
    return None


def extract_user_id(payload: dict) -> Optional[str]:
    return payload.get("sub")
