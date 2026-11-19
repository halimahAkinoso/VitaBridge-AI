
import os
import hmac
import hashlib
import secrets

from datetime import datetime, timedelta, timezone
from argon2 import PasswordHasher
from argon2.exceptions import VerificationError
from jose import jwt

# Development fallback only.
# Set a strong random JWT_SECRET environment variable before deployment.
APP_ENV = os.getenv("APP_ENV", "development").lower()
configured_secret = os.getenv("JWT_SECRET")
if APP_ENV in {"demo", "production"} and not configured_secret:
    raise RuntimeError("JWT_SECRET must be configured outside development.")

SECRET = configured_secret or "VitaBridge-local-development-secret-change-before-deployment"

ALG = "HS256"

PBKDF2_ITERATIONS = 310_000
ARGON2_PASSWORD_HASHER = PasswordHasher()


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)

    password_hash = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        PBKDF2_ITERATIONS,
    ).hex()

    return (
        f"pbkdf2_sha256${PBKDF2_ITERATIONS}"
        f"${salt}${password_hash}"
    )


def verify_password(password: str, stored_hash: str) -> bool:
    if stored_hash.startswith("$argon2"):
        try:
            return ARGON2_PASSWORD_HASHER.verify(stored_hash, password)
        except VerificationError:
            return False

    try:
        algorithm, iterations, salt, expected_hash = stored_hash.split("$")

        if algorithm != "pbkdf2_sha256":
            return False

        calculated_hash = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode("utf-8"),
            salt.encode("utf-8"),
            int(iterations),
        ).hex()

        return hmac.compare_digest(
            calculated_hash,
            expected_hash,
        )

    except (ValueError, TypeError):
        return False


def needs_password_rehash(stored_hash: str) -> bool:
    return stored_hash.startswith("$argon2")


def create_token(data: dict):
    to_encode = dict(data)

    to_encode.update({
        "exp": datetime.now(timezone.utc) + timedelta(hours=1)
    })

    return jwt.encode(
        to_encode,
        SECRET,
        algorithm=ALG,
    )


def decode_token(token: str):
    return jwt.decode(
        token,
        SECRET,
        algorithms=[ALG],
    )
