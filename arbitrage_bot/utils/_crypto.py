"""
Simple AES-128-CBC + HMAC-SHA256 encryption helper.

Replaces cryptography.fernet since pycryptodome is available in this environment.
Format: base64url( IV[16] + ciphertext + HMAC[32] )
Key derivation: SHA-256(password) → first 16 bytes = AES key, last 16 bytes = HMAC key
"""
from __future__ import annotations
import base64
import hashlib
import hmac
import os
import struct

from Crypto.Cipher import AES
from Crypto.Util.Padding import pad, unpad


def _derive_keys(password: str):
    digest = hashlib.sha256(password.encode()).digest()
    return digest[:16], digest[16:]   # aes_key, mac_key


def encrypt(plaintext: str, password: str) -> str:
    aes_key, mac_key = _derive_keys(password)
    iv = os.urandom(16)
    cipher = AES.new(aes_key, AES.MODE_CBC, iv)
    ct = cipher.encrypt(pad(plaintext.encode(), 16))
    payload = iv + ct
    mac = hmac.new(mac_key, payload, hashlib.sha256).digest()
    return base64.urlsafe_b64encode(payload + mac).decode()


def decrypt(token: str, password: str) -> str:
    aes_key, mac_key = _derive_keys(password)
    raw = base64.urlsafe_b64decode(token.encode())
    payload, mac_given = raw[:-32], raw[-32:]
    mac_expected = hmac.new(mac_key, payload, hashlib.sha256).digest()
    if not hmac.compare_digest(mac_expected, mac_given):
        raise ValueError("Decryption failed — wrong password or corrupted data")
    iv, ct = payload[:16], payload[16:]
    cipher = AES.new(aes_key, AES.MODE_CBC, iv)
    return unpad(cipher.decrypt(ct), 16).decode()
