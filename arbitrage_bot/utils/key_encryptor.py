"""
Private key encryption utility.

Run this ONCE to encrypt your private keys before putting them in config.yaml.
The script will:
  1. Ask for a password (stored only in memory / your env var).
  2. Encrypt the private key using Fernet (AES-128-CBC + HMAC-SHA256).
  3. Print the encrypted string to paste into config.yaml.

Usage:
    python utils/key_encryptor.py

Security model:
    - The encryption key is derived from your password via SHA-256.
    - The same password must be set in ARB_KEY_PASSWORD before running main.py.
    - Never commit a decrypted private key or your password to version control.
"""
from __future__ import annotations

import base64
import getpass
import hashlib
import sys


def _derive_fernet_key(password: str) -> bytes:
    key_bytes = hashlib.sha256(password.encode()).digest()
    return base64.urlsafe_b64encode(key_bytes)


def encrypt_key(private_key: str, password: str) -> str:
    from cryptography.fernet import Fernet
    fernet = Fernet(_derive_fernet_key(password))
    return fernet.encrypt(private_key.encode()).decode()


def decrypt_key(encrypted: str, password: str) -> str:
    from cryptography.fernet import Fernet, InvalidToken
    fernet = Fernet(_derive_fernet_key(password))
    try:
        return fernet.decrypt(encrypted.encode()).decode()
    except InvalidToken:
        sys.exit("ERROR: Decryption failed. Wrong password or corrupted ciphertext.")


def main() -> None:
    print("=" * 60)
    print("  Arbitrage Bot — Private Key Encryptor")
    print("=" * 60)
    print()
    print("This utility encrypts your EVM private keys so they can be")
    print("safely stored in config.yaml.")
    print()
    print("WARNING: Your raw private key will be visible in this terminal.")
    print("         Run this on a secure, offline machine if possible.")
    print()

    password = getpass.getpass("Set encryption password (will be needed at bot startup): ")
    password2 = getpass.getpass("Confirm password: ")
    if password != password2:
        sys.exit("ERROR: Passwords do not match.")

    print()
    print("--- Hyperliquid Private Key ---")
    hl_raw = getpass.getpass("Enter HL private key (0x...): ").strip()
    if not hl_raw:
        sys.exit("ERROR: No key entered.")

    hl_enc = encrypt_key(hl_raw, password)
    print()
    print("Encrypted HL key (paste into config.yaml → hyperliquid.private_key_encrypted):")
    print(f"  {hl_enc}")
    print()

    print("--- Aster (EVM) Private Key ---")
    aster_raw = getpass.getpass("Enter Aster private key (0x...): ").strip()
    if not aster_raw:
        sys.exit("ERROR: No key entered.")

    aster_enc = encrypt_key(aster_raw, password)
    print()
    print("Encrypted Aster key (paste into config.yaml → aster.private_key_encrypted):")
    print(f"  {aster_enc}")
    print()

    print("=" * 60)
    print("Done. Now set the environment variable before running main.py:")
    print()
    print('  export ARB_KEY_PASSWORD="your_password_here"')
    print()
    print("Or add it to a .env file (which is git-ignored):")
    print()
    print('  echo \'ARB_KEY_PASSWORD="your_password_here"\' >> .env')
    print("=" * 60)

    # Quick self-test
    assert decrypt_key(hl_enc, password) == hl_raw, "HL key round-trip failed"
    assert decrypt_key(aster_enc, password) == aster_raw, "Aster key round-trip failed"
    print("\nSelf-test passed — encryption is working correctly.")


if __name__ == "__main__":
    main()
