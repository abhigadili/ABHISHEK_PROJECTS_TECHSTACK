from datetime import timedelta

import jwt
import pytest

from sms_common.errors import UnauthorizedError
from sms_common.security import (
    ROLE_SCOPES, Role, create_token, decode_token, scopes_for_roles,
)


def test_roundtrip_claims(settings):
    token, claims = create_token(settings, subject=7, token_type="access", ttl=timedelta(minutes=5),
                                 email="a@b.com", roles=["ADMIN"], scopes=["users:manage", "students:read"])
    decoded = decode_token(settings, token)
    assert decoded.sub == "7" and decoded.roles == ["ADMIN"] and decoded.jti == claims.jti
    assert decoded.scope == "students:read users:manage"


def test_expired_token_rejected(settings):
    token, _ = create_token(settings, subject=1, token_type="access", ttl=timedelta(seconds=-5))
    with pytest.raises(UnauthorizedError, match="expired"):
        decode_token(settings, token)


def test_wrong_signature_rejected(settings):
    token, _ = create_token(settings, subject=1, token_type="access", ttl=timedelta(minutes=1))
    bad = settings.model_copy(update={"jwt_secret": type(settings.jwt_secret)("y" * 40)})
    with pytest.raises(UnauthorizedError):
        decode_token(bad, token)


def test_alg_none_rejected(settings):
    forged = jwt.encode({"sub": "1", "type": "access", "jti": "j", "iss": settings.jwt_issuer,
                         "iat": 1, "exp": 9999999999}, key=None, algorithm="none")
    with pytest.raises(UnauthorizedError):
        decode_token(settings, forged)


def test_wrong_type_rejected(settings):
    token, _ = create_token(settings, subject=1, token_type="refresh", ttl=timedelta(minutes=1))
    with pytest.raises(UnauthorizedError, match="Wrong token type"):
        decode_token(settings, token, "access")


def test_wrong_issuer_rejected(settings):
    token, _ = create_token(settings, subject=1, token_type="access", ttl=timedelta(minutes=1))
    other = settings.model_copy(update={"jwt_issuer": "someone-else"})
    with pytest.raises(UnauthorizedError):
        decode_token(other, token)


def test_role_scope_matrix():
    assert ROLE_SCOPES[Role.ADMIN] >= ROLE_SCOPES[Role.TEACHER] >= ROLE_SCOPES[Role.STUDENT] - {"profile:self"}
    assert "users:manage" in scopes_for_roles(["ADMIN"]) and "users:manage" not in scopes_for_roles(["TEACHER"])
    assert scopes_for_roles(["NOPE"]) == set()
