"""Verify the optional OpenID Connect authorization-code flow against a MOCK provider.

* mock provider (FastAPI, :9100): discovery, /authorize, /token, /userinfo
* second Auth-service instance (:8101) configured with OIDC_* environment variables
The main stack is untouched (its Auth service has OIDC disabled -> 501).
"""

from __future__ import annotations

import os
import signal
import subprocess
import sys
import threading
import time
import uuid
from pathlib import Path
from urllib.parse import parse_qs, urlparse

import httpx
import uvicorn
from fastapi import FastAPI, Form, Header, HTTPException, Query
from fastapi.responses import RedirectResponse

ROOT = Path(__file__).resolve().parent.parent
RUN = uuid.uuid4().hex[:6]
ISSUER, AUTH2 = "http://127.0.0.1:9100", "http://127.0.0.1:8101"
CLIENT_ID, CLIENT_SECRET = "sms-test-client", uuid.uuid4().hex
results: list[bool] = []

# ------------------------------------------------------------------ mock provider
provider = FastAPI()
CODES: dict[str, str] = {}
SCENARIO_USERS = {
    "ok": {"sub": f"mock-sub-{RUN}", "email": f"oidc{RUN}@example.com", "email_verified": True, "name": "Olivia Idp"},
    "unverified": {"sub": f"mock-unv-{RUN}", "email": f"unv{RUN}@example.com", "email_verified": False, "name": "Un Verified"},
    "conflict": {"sub": f"mock-con-{RUN}", "email": "stu1@example.com", "email_verified": True, "name": "Clash"},
}


@provider.get("/.well-known/openid-configuration")
def discovery() -> dict:
    return {"issuer": ISSUER, "authorization_endpoint": f"{ISSUER}/authorize", "token_endpoint": f"{ISSUER}/token",
            "userinfo_endpoint": f"{ISSUER}/userinfo"}


@provider.get("/authorize")
def authorize(client_id: str, redirect_uri: str, state: str, scenario: str = "ok", response_type: str = "code"):
    code = f"{scenario}-{uuid.uuid4().hex}"
    CODES[code] = scenario
    return RedirectResponse(f"{redirect_uri}?code={code}&state={state}", status_code=302)


@provider.post("/token")
def token(code: str = Form(...), client_id: str = Form(...), client_secret: str = Form(...), grant_type: str = Form(...)):
    if client_secret != CLIENT_SECRET or client_id != CLIENT_ID or code not in CODES:
        raise HTTPException(400, "invalid_grant")
    return {"access_token": f"at-{code}", "token_type": "Bearer"}


@provider.get("/userinfo")
def userinfo(authorization: str = Header(...)):
    code = authorization.removeprefix("Bearer at-")
    if code not in CODES:
        raise HTTPException(401)
    return SCENARIO_USERS[CODES[code]]


def check(name: str, ok: bool, detail: str = "") -> None:
    results.append(bool(ok))
    print(f"  [{'PASS' if ok else 'FAIL'}] {name}" + ("" if ok else f" -> {detail}"))


def full_flow(scenario: str = "ok", mutate_state=None) -> httpx.Response:
    c = httpx.Client(timeout=20, follow_redirects=False)
    r = c.get(f"{AUTH2}/api/v1/auth/oidc/login")
    assert r.status_code == 302, r.text
    loc = r.headers["location"]
    if mutate_state:
        loc = loc.replace(parse_qs(urlparse(loc).query)["state"][0], mutate_state(parse_qs(urlparse(loc).query)["state"][0]))
    r = c.get(loc + f"&scenario={scenario}")  # provider authorises -> redirects to our callback
    assert r.status_code == 302
    return c.get(r.headers["location"])


def main() -> int:
    server = uvicorn.Server(uvicorn.Config(provider, host="127.0.0.1", port=9100, log_level="error"))
    threading.Thread(target=server.run, daemon=True).start()
    env = dict(os.environ, OIDC_ISSUER=ISSUER, OIDC_CLIENT_ID=CLIENT_ID, OIDC_CLIENT_SECRET=CLIENT_SECRET,
               OIDC_REDIRECT_URI=f"{AUTH2}/api/v1/auth/oidc/callback")
    proc = subprocess.Popen([str(ROOT / ".venv/bin/uvicorn"), "app.main:app", "--port", "8101"], cwd=ROOT / "services/auth",
                            env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        for _ in range(60):
            try:
                if httpx.get(f"{AUTH2}/health", timeout=1).status_code == 200 and httpx.get(f"{ISSUER}/.well-known/openid-configuration", timeout=1).status_code == 200:
                    break
            except Exception:
                time.sleep(0.25)
        print("=== OpenID Connect (authorization-code flow, mock provider)")
        r = httpx.get("http://127.0.0.1:8001/api/v1/auth/oidc/login", follow_redirects=False)
        check("main Auth service (OIDC not configured) -> 501", r.status_code == 501 and r.json()["error"]["code"] == "OIDC_NOT_CONFIGURED", r.text[:150])
        r = httpx.get(f"{AUTH2}/api/v1/auth/oidc/login", follow_redirects=False)
        q = parse_qs(urlparse(r.headers.get("location", "")).query)
        check("login redirects to the provider with client_id, redirect_uri, scope openid and signed state",
              r.status_code == 302 and q.get("client_id") == [CLIENT_ID] and "openid" in q["scope"][0] and q["response_type"] == ["code"] and len(q["state"][0]) > 50)
        r = full_flow("ok")
        tok = r.json() if r.status_code == 200 else {}
        check("callback exchanges the code (sync HTTPX) and returns our own JWT pair", r.status_code == 200 and "access_token" in tok and "refresh_token" in tok, r.text[:200])
        me = httpx.get(f"{AUTH2}/api/v1/auth/me", headers={"Authorization": f"Bearer {tok.get('access_token', '')}"}).json()
        check("user auto-provisioned: provider e-mail, auth_provider=oidc, role STUDENT",
              me.get("email") == SCENARIO_USERS["ok"]["email"] and me.get("auth_provider") == "oidc" and me.get("roles") == ["STUDENT"], str(me))
        r2 = full_flow("ok")
        me2 = httpx.get(f"{AUTH2}/api/v1/auth/me", headers={"Authorization": f"Bearer {r2.json().get('access_token', '')}"}).json()
        check("second login maps to the SAME user (no duplicate account)", me2.get("id") == me.get("id"))
        r = httpx.post(f"{AUTH2}/api/v1/auth/login", json={"email": me["email"], "password": "Str0ng!Passw0rd#1"})
        check("OIDC user cannot log in with a password (unusable local credential)", r.status_code == 401)
        r = full_flow("ok", mutate_state=lambda s: s[:-3] + "xyz")
        check("forged/tampered state -> 401 (CSRF protection)", r.status_code == 401)
        r = full_flow("unverified")
        check("provider e-mail not verified -> 400", r.status_code == 400)
        r = full_flow("conflict")
        check("e-mail already registered locally -> 409 (no silent account takeover)", r.status_code == 409)
        r = httpx.get(f"{AUTH2}/api/v1/auth/oidc/callback", params={"code": "bogus", "state": "x" * 60}, follow_redirects=False)
        check("callback with bogus state -> 401", r.status_code == 401)
    finally:
        proc.send_signal(signal.SIGTERM)
        proc.wait(timeout=10)
        server.should_exit = True
    print(f"\nRESULT: {sum(results)}/{len(results)} checks passed")
    return 0 if all(results) else 1


if __name__ == "__main__":
    sys.exit(main())
