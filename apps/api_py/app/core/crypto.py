import base64
from os import urandom

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from app.core.config import get_settings


def _get_key() -> bytes:
    settings = get_settings()
    if not settings.SECRET_ENCRYPTION_KEY:
        raise ValueError(
            "SECRET_ENCRYPTION_KEY is required. "
            'Generate one with: python -c "import base64, os; print(base64.urlsafe_b64encode(os.urandom(32)).decode())"'
        )
    try:
        key = base64.urlsafe_b64decode(settings.SECRET_ENCRYPTION_KEY.encode("utf-8"))
    except Exception as exc:
        raise ValueError("SECRET_ENCRYPTION_KEY is not valid base64") from exc
    if len(key) != 32:
        raise ValueError(
            "SECRET_ENCRYPTION_KEY must decode to exactly 32 bytes (AES-256)"
        )
    return key


def encrypt_secret_value(value: str) -> bytes:
    aesgcm = AESGCM(_get_key())
    nonce = urandom(12)
    ciphertext = aesgcm.encrypt(nonce, value.encode("utf-8"), None)
    return nonce + ciphertext


def decrypt_secret_value(payload: bytes) -> str:
    aesgcm = AESGCM(_get_key())
    nonce = payload[:12]
    ciphertext = payload[12:]
    plaintext = aesgcm.decrypt(nonce, ciphertext, None)
    return plaintext.decode("utf-8")
