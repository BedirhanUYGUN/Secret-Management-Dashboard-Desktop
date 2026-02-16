import base64
from hashlib import sha256
from os import urandom

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from app.core.config import get_settings


def _get_key() -> bytes:
    settings = get_settings()
    if settings.SECRET_ENCRYPTION_KEY:
        try:
            key = base64.urlsafe_b64decode(
                settings.SECRET_ENCRYPTION_KEY.encode("utf-8")
            )
            if len(key) == 32:
                return key
        except Exception:  # noqa: BLE001
            pass
    return sha256((settings.JWT_SECRET_KEY + "::secret").encode("utf-8")).digest()


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
