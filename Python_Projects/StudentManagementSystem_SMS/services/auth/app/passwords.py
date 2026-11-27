"""Password hashing (Argon2id) and password-policy validation."""

from __future__ import annotations

import re

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError


class PasswordService:
    """Argon2id with library defaults (RFC 9106 low-memory profile).

    Encapsulation: the rest of the code never touches argon2 directly, so the
    algorithm can change (e.g. to bcrypt) in this single class.
    """

    def __init__(self) -> None:
        self._hasher = PasswordHasher()
        # Verified against when the account does not exist, so response time
        # does not reveal whether an email is registered (user enumeration).
        self._dummy = self._hasher.hash("not-a-real-password")

    def hash(self, password: str) -> str:
        return self._hasher.hash(password)

    def verify(self, password_hash: str, password: str) -> bool:
        try:
            return self._hasher.verify(password_hash, password)
        except (VerifyMismatchError, VerificationError, InvalidHashError):
            return False

    def needs_rehash(self, password_hash: str) -> bool:
        return self._hasher.check_needs_rehash(password_hash)

    def burn_time(self, password: str) -> None:
        self.verify(self._dummy, password)


_SPECIAL = re.compile(r"[^A-Za-z0-9]")


def validate_password_strength(value: str) -> str:
    problems = []
    if len(value) < 10:
        problems.append("at least 10 characters")
    if len(value) > 128:
        problems.append("at most 128 characters")
    if not re.search(r"[a-z]", value):
        problems.append("a lowercase letter")
    if not re.search(r"[A-Z]", value):
        problems.append("an uppercase letter")
    if not re.search(r"\d", value):
        problems.append("a digit")
    if not _SPECIAL.search(value):
        problems.append("a special character")
    if problems:
        raise ValueError("Password must contain " + ", ".join(problems))
    return value
