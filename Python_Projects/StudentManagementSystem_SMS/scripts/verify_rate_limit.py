"""Verify rate limiting on a throw-away gateway instance (port 8100) with tiny limits.

The main stack is untouched.  Requires the five services to be running.
"""

from __future__ import annotations

import os
import signal
import subprocess
import sys
import time
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parent.parent
PORT = 8100
results: list[bool] = []


def check(name: str, ok: bool, detail: str = "") -> None:
    results.append(ok)
    print(f"  [{'PASS' if ok else 'FAIL'}] {name}" + ("" if ok else f" -> {detail}"))


def env_value(key: str) -> str:
    for line in (ROOT / ".env").read_text().splitlines():
        if line.startswith(key + "="):
            return line.split("=", 1)[1]
    raise SystemExit(f"{key} missing")


def main() -> int:
    env = dict(os.environ, RATE_LIMIT_LOGIN="5/minute", RATE_LIMIT_AUTH="8/minute", RATE_LIMIT_DEFAULT="10/minute")
    proc = subprocess.Popen([str(ROOT / ".venv/bin/uvicorn"), "app.main:app", "--port", str(PORT)],
                            cwd=ROOT / "services/gateway", env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        base = f"http://127.0.0.1:{PORT}"
        for _ in range(40):
            try:
                if httpx.get(f"{base}/health", timeout=1).status_code == 200:
                    break
            except Exception:
                time.sleep(0.25)
        print("=== Rate limiting (gateway with login=5/min, auth=8/min, default=10/min)")
        c = httpx.Client(base_url=base, timeout=10)

        codes = [c.post("/api/v1/auth/login", json={"email": "nobody@example.com", "password": "Bad!Passw0rd#9"}).status_code
                 for _ in range(7)]
        check("login attempts: 5 reach the Auth service (401), 6th and 7th are blocked with 429", codes == [401] * 5 + [429] * 2, str(codes))
        r = c.post("/api/v1/auth/login", json={"email": "nobody@example.com", "password": "x"})
        body = r.json()
        check("429 uses the standard error envelope + Retry-After header",
              r.status_code == 429 and body["error"]["code"] == "RATE_LIMITED" and int(r.headers["retry-after"]) > 0, r.text[:160])

        codes = [c.post("/api/v1/auth/refresh", json={"refresh_token": "x"}).status_code for _ in range(10)]
        check("other /auth/* endpoints use the separate 'auth' limit (8/min): 8x401 then 429", codes == [401] * 8 + [429] * 2, str(codes))

        admin_tok = httpx.post("http://127.0.0.1:8001/api/v1/auth/token",
                               data={"username": env_value("BOOTSTRAP_ADMIN_EMAIL"), "password": env_value("BOOTSTRAP_ADMIN_PASSWORD")}).json()["access_token"]
        other_tok = httpx.post("http://127.0.0.1:8001/api/v1/auth/token",
                               data={"username": "stu1@example.com", "password": "Str0ng!Passw0rd"}).json().get("access_token")
        h = {"Authorization": f"Bearer {admin_tok}"}
        rs = [c.get("/api/v1/departments", headers=h) for _ in range(12)]
        codes = [r.status_code for r in rs]
        check("general API: 10/min PER USER -> first 10 succeed, then 429", codes[:10] == [200] * 10 and codes[10:] == [429, 429], str(codes))
        check("X-RateLimit-* headers on successful responses", rs[0].headers.get("x-ratelimit-limit") == "10" and rs[0].headers.get("x-ratelimit-remaining") == "9")
        if other_tok:
            r = c.get("/api/v1/departments", headers={"Authorization": f"Bearer {other_tok}"})
            check("a different user is NOT affected by the first user's quota (user-based key)", r.status_code == 200, str(r.status_code))
        r = c.get("/health")
        check("health endpoints are not rate limited", r.status_code == 200)
    finally:
        proc.send_signal(signal.SIGTERM)
        proc.wait(timeout=10)
    ok = all(results)
    print(f"\nRESULT: {sum(results)}/{len(results)} checks passed")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
