"""AES-256-GCM 加密/解密工具，用于数据源密码的加密存储。

密钥 DATASOURCE_ENCRYPTION_KEY 从 Settings 读取（来自 .env 或环境变量），
应为 32 字节的 Base64 编码字符串。
生成方式: python -c "import base64,os; print(base64.urlsafe_b64encode(os.urandom(32)).decode())"
"""

import base64
import os

from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from app.core.config import settings


def _get_key() -> bytes:
    key_b64 = settings.datasource_encryption_key
    if not key_b64:
        raise RuntimeError("DATASOURCE_ENCRYPTION_KEY 环境变量未设置")
    try:
        key = base64.urlsafe_b64decode(key_b64)
    except Exception:
        raise RuntimeError("DATASOURCE_ENCRYPTION_KEY 不是有效的 Base64 编码")
    if len(key) != 32:
        raise RuntimeError(f"DATASOURCE_ENCRYPTION_KEY 解码后应为 32 字节，实际 {len(key)} 字节")
    return key


def encrypt_password(plaintext: str) -> str:
    """AES-256-GCM 加密，返回 Base64 编码的密文（格式：nonce + ciphertext + tag）。"""
    key = _get_key()
    nonce = os.urandom(12)
    aesgcm = AESGCM(key)
    ciphertext = aesgcm.encrypt(nonce, plaintext.encode("utf-8"), None)
    # nonce(12) + ciphertext_and_tag 合并后 Base64 编码
    return base64.b64encode(nonce + ciphertext).decode("utf-8")


def decrypt_password(ciphertext_b64: str) -> str:
    """解密 AES-256-GCM 密文，返回明文密码。"""
    key = _get_key()
    raw = base64.b64decode(ciphertext_b64)
    nonce = raw[:12]
    ciphertext = raw[12:]
    aesgcm = AESGCM(key)
    plaintext = aesgcm.decrypt(nonce, ciphertext, None)
    return plaintext.decode("utf-8")
