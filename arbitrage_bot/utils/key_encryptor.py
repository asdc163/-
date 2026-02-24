"""
Credential encryption utility for the arbitrage bot.

Encrypts all sensitive credentials using Fernet (AES-128-CBC + HMAC-SHA256)
and prints the encrypted strings to paste into config.yaml.

Credentials handled:
  - Hyperliquid  : EVM wallet private key (0x...)
  - Aster DEX    : REST API key + API secret (from Aster API settings page)
  - Telegram bot : Bot token (from @BotFather)

Usage:
    python utils/key_encryptor.py

Security model:
  - Encryption key = SHA-256(password), stored only in your environment.
  - Set before running main.py: export ARB_KEY_PASSWORD="your_password"
  - Never commit your raw credentials or password to version control.
"""
from __future__ import annotations

import base64
import getpass
import hashlib
import sys


def _derive_fernet_key(password: str) -> bytes:
    key_bytes = hashlib.sha256(password.encode()).digest()
    return base64.urlsafe_b64encode(key_bytes)


def encrypt_key(plaintext: str, password: str) -> str:
    from cryptography.fernet import Fernet
    fernet = Fernet(_derive_fernet_key(password))
    return fernet.encrypt(plaintext.encode()).decode()


def decrypt_key(encrypted: str, password: str) -> str:
    from cryptography.fernet import Fernet, InvalidToken
    fernet = Fernet(_derive_fernet_key(password))
    try:
        return fernet.decrypt(encrypted.encode()).decode()
    except InvalidToken:
        sys.exit("ERROR: Decryption failed — wrong password or corrupted ciphertext.")


def _prompt_secret(label: str, optional: bool = False) -> str:
    """Prompt for a secret value. Returns empty string if optional and blank."""
    while True:
        value = getpass.getpass(f"{label}: ").strip()
        if value:
            return value
        if optional:
            print("  (skipped)")
            return ""
        print("  Value cannot be empty. Try again.")


def main() -> None:
    print("=" * 65)
    print("  Arbitrage Bot — Credential Encryptor")
    print("=" * 65)
    print()
    print("This utility encrypts your credentials so they can be safely")
    print("stored in config.yaml.  Your raw values are visible only in")
    print("this terminal session and are never written to disk.")
    print()
    print("TIP: Run this on a secure machine with a clean terminal.")
    print()

    # ----------------------------------------------------------------
    # Set encryption password
    # ----------------------------------------------------------------
    password = getpass.getpass("Set encryption password (you'll need this at bot startup): ")
    password2 = getpass.getpass("Confirm password: ")
    if password != password2:
        sys.exit("ERROR: Passwords do not match.")
    print()

    encrypted = {}

    # ----------------------------------------------------------------
    # Hyperliquid — wallet private key
    # ----------------------------------------------------------------
    print("─" * 65)
    print("1.  HYPERLIQUID — Wallet Private Key")
    print("    (The EVM private key for your HL trading wallet, starts with 0x)")
    print("─" * 65)
    hl_key = _prompt_secret("HL private key (0x...)")
    encrypted["hl_private_key"] = encrypt_key(hl_key, password)
    print()

    # ----------------------------------------------------------------
    # Aster DEX — REST API key + secret
    # ----------------------------------------------------------------
    print("─" * 65)
    print("2.  ASTER DEX — REST API Key & Secret")
    print("    (Create at: https://asterdex.com → Account → API Management)")
    print("─" * 65)
    aster_api_key = _prompt_secret("Aster API key")
    aster_api_secret = _prompt_secret("Aster API secret")
    encrypted["aster_api_key"] = encrypt_key(aster_api_key, password)
    encrypted["aster_api_secret"] = encrypt_key(aster_api_secret, password)
    print()

    # ----------------------------------------------------------------
    # Telegram bot token (optional)
    # ----------------------------------------------------------------
    print("─" * 65)
    print("3.  TELEGRAM — Bot Token  (optional, press Enter to skip)")
    print("    (Create a bot at @BotFather and copy the token)")
    print("─" * 65)
    tg_token = _prompt_secret("Telegram bot token", optional=True)
    if tg_token:
        encrypted["telegram_bot_token"] = encrypt_key(tg_token, password)
    print()

    # ----------------------------------------------------------------
    # Print results
    # ----------------------------------------------------------------
    print("=" * 65)
    print("  Encrypted values — paste these into config.yaml")
    print("=" * 65)
    print()
    print("hyperliquid:")
    print(f"  private_key_encrypted: \"{encrypted['hl_private_key']}\"")
    print()
    print("aster:")
    print(f"  api_key_encrypted: \"{encrypted['aster_api_key']}\"")
    print(f"  api_secret_encrypted: \"{encrypted['aster_api_secret']}\"")
    print()
    if tg_token:
        print("telegram:")
        print(f"  bot_token_encrypted: \"{encrypted['telegram_bot_token']}\"")
        print()

    print("=" * 65)
    print("After pasting the values, start the bot with:")
    print()
    print('  export ARB_KEY_PASSWORD="your_password_here"')
    print("  python main.py")
    print()
    print("Or load from .env (git-ignored):")
    print()
    print('  echo \'ARB_KEY_PASSWORD="your_password"\' >> .env')
    print("  python main.py")
    print("=" * 65)

    # Self-test
    assert decrypt_key(encrypted["hl_private_key"], password) == hl_key
    assert decrypt_key(encrypted["aster_api_key"], password) == aster_api_key
    assert decrypt_key(encrypted["aster_api_secret"], password) == aster_api_secret
    if tg_token:
        assert decrypt_key(encrypted["telegram_bot_token"], password) == tg_token
    print("\nSelf-test passed — all credentials encrypted correctly.")


if __name__ == "__main__":
    main()
