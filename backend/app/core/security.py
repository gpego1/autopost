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
from cryptography.hazmat.primitives.asymmetric.ec import ECDSA, EllipticCurvePublicNumbers, SECP256R1, SECP384R1
from cryptography.hazmat.primitives.asymmetric.padding import PKCS1v15
from cryptography.hazmat.primitives.asymmetric.rsa import RSAPublicNumbers
from cryptography.hazmat.primitives.asymmetric.utils import encode_dss_signature
from cryptography.hazmat.primitives.hashes import SHA256

from app.core.config import settings

logger = logging.getLogger(__name__)

# kid → public key (RSAPublicKey or EllipticCurvePublicKey); refreshed every 5 minutes
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
    """Fetch Supabase JWKS and build a kid → public key map (RSA and EC)."""
    global _rsa_keys, _rsa_keys_time
    now = time.monotonic()
    if _rsa_keys and (now - _rsa_keys_time) < _JWKS_TTL:
        return _rsa_keys

    url = f"{settings.supabase_url}/auth/v1/.well-known/jwks.json"
    logger.info("Fetching JWKS from %s", url)
    async with httpx.AsyncClient(timeout=4) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        data = resp.json()

    new_keys: dict = {}
    for key_data in data.get("keys", []):
        try:
            kid = key_data.get("kid", "__default__")
            kty = key_data.get("kty")

            if kty == "RSA":
                n = int.from_bytes(_b64url_decode(key_data["n"]), "big")
                e = int.from_bytes(_b64url_decode(key_data["e"]), "big")
                new_keys[kid] = RSAPublicNumbers(e=e, n=n).public_key()
                logger.info("RSA public key loaded: kid=%s", kid)

            elif kty == "EC":
                crv = key_data.get("crv", "P-256")
                x = int.from_bytes(_b64url_decode(key_data["x"]), "big")
                y = int.from_bytes(_b64url_decode(key_data["y"]), "big")
                curve = SECP384R1() if crv == "P-384" else SECP256R1()
                new_keys[kid] = EllipticCurvePublicNumbers(x=x, y=y, curve=curve).public_key()
                logger.info("EC public key loaded: kid=%s crv=%s", kid, crv)

            else:
                logger.info("Skipping unsupported JWKS key type: kty=%s kid=%s", kty, kid)

        except Exception as exc:
            logger.warning("Skipping bad JWKS key (kid=%s): %s", key_data.get("kid"), exc)

    _rsa_keys = new_keys
    _rsa_keys_time = now
    logger.info("JWKS refreshed — %d key(s) loaded", len(new_keys))
    return new_keys


def _verify_rs256(signing_input: bytes, signature: bytes, rsa_key) -> None:
    """Raise InvalidSignature if the RS256 signature is wrong."""
    rsa_key.verify(signature, signing_input, PKCS1v15(), SHA256())


def _verify_es256(signing_input: bytes, signature: bytes, ec_key) -> None:
    """Raise InvalidSignature if the ES256 signature is wrong.
    JWT packs ES256 signatures as raw 64-byte R||S (not DER); convert before verifying."""
    if len(signature) != 64:
        raise ValueError(f"ES256 signature must be 64 bytes, got {len(signature)}")
    r = int.from_bytes(signature[:32], "big")
    s = int.from_bytes(signature[32:], "big")
    ec_key.verify(encode_dss_signature(r, s), signing_input, ECDSA(SHA256()))


def _verify_hs256(signing_input: bytes, signature: bytes, secret: str) -> None:
    """Raise ValueError if the HS256 signature is wrong."""
    expected = hmac.new(secret.encode("utf-8"), signing_input, hashlib.sha256).digest()
    if not hmac.compare_digest(signature, expected):
        raise ValueError("HS256 signature mismatch")


# ── Public API ────────────────────────────────────────────────────────────────

async def verify_supabase_jwt(token: str) -> Optional[dict]:
    """
    Verify a Supabase JWT using the cryptography library directly.

    ES256/RS256 paths: fetch public keys from Supabase JWKS endpoint, select
    by kid header, verify with the matching algorithm.
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

    if alg in ("RS256", "ES256"):
        try:
            keys = await _refresh_rsa_keys()
            key = keys.get(kid) if kid else None
            if key is None and keys:
                key = next(iter(keys.values()))
            if key is None:
                logger.warning("%s: JWKS returned no usable keys", alg)
                return None
            if alg == "RS256":
                _verify_rs256(signing_input, signature, key)
            else:
                _verify_es256(signing_input, signature, key)
            logger.info("%s verification OK for sub=%s", alg, payload.get("sub"))
            return payload
        except InvalidSignature:
            logger.warning("%s signature invalid (wrong key or tampered token)", alg)
            return None
        except Exception as exc:
            logger.warning("%s verification error: %s", alg, exc)
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
