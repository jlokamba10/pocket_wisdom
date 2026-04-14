from __future__ import annotations

import secrets
import string


def generate_temp_password(length: int = 12) -> str:
    alphabet = string.ascii_letters + string.digits + "!@#$%*+?"
    return "".join(secrets.choice(alphabet) for _ in range(length))
