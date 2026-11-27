import pytest
from pydantic import ValidationError

from app.passwords import PasswordService, validate_password_strength
from app.schemas import ChangePasswordRequest, RegisterRequest


def test_argon2_hash_verify_and_salting():
    svc = PasswordService()
    h1, h2 = svc.hash("Str0ng!Passw0rd"), svc.hash("Str0ng!Passw0rd")
    assert h1 != h2 and h1.startswith("$argon2id$")  # unique salt per hash
    assert svc.verify(h1, "Str0ng!Passw0rd") and not svc.verify(h1, "wrong")
    assert not svc.verify("not-a-hash", "x")  # corrupt hash never raises
    assert "Str0ng" not in h1  # never plain text


@pytest.mark.parametrize("pwd,missing", [
    ("short1!A", "10 characters"), ("alllowercase1!", "uppercase"), ("ALLUPPERCASE1!", "lowercase"),
    ("NoDigitsHere!!", "digit"), ("NoSpecial1234Aa", "special"),
])
def test_password_policy(pwd, missing):
    with pytest.raises(ValueError, match=missing):
        validate_password_strength(pwd)


def test_register_normalises_and_validates():
    r = RegisterRequest(email="A@Example.COM", full_name="  Ann   Lee ", password="Str0ng!Passw0rd")
    assert r.email == "a@example.com" and r.full_name == "Ann Lee"
    with pytest.raises(ValidationError):
        RegisterRequest(email="bad", full_name="Ann", password="Str0ng!Passw0rd")


def test_change_password_must_differ():
    with pytest.raises(ValidationError, match="must differ"):
        ChangePasswordRequest(current_password="Str0ng!Passw0rd", new_password="Str0ng!Passw0rd")
