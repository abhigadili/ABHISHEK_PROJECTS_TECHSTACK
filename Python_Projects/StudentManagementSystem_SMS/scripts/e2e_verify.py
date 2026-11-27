"""End-to-end verification against the RUNNING stack (through the API gateway).

    python scripts/e2e_verify.py [--gateway http://localhost:8000]

Every check prints PASS/FAIL; the exit code is non-zero if anything failed.
Test data is namespaced with a random run id (e2e<id>) so reruns never collide.
"""

from __future__ import annotations

import argparse
import asyncio
import base64
import email
import email.policy
import hashlib
import json
import os
import re
import struct
import subprocess
import sys
import time
import uuid
import zlib
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parent.parent
RUN = uuid.uuid4().hex[:6]
LET = "".join(chr(65 + int(c, 16)) for c in RUN[:3])  # letters only: course codes are LETTERS+DIGITS
PWD = "Str0ng!Passw0rd#1"
results: list[tuple[bool, str]] = []


DOCKER = False  # set by --docker: logs/e-mails/files live in containers / ./var/compose


def read_log(svc: str) -> str:
    """Service log text for both run modes (local files or ``docker compose logs``)."""
    if not DOCKER:
        return (ROOT / "var" / "logs" / f"{svc}.log").read_text()
    name = "api-gateway" if svc == "gateway" else f"{svc}-service"
    out = subprocess.run(["docker", "compose", "logs", "--no-color", "--no-log-prefix", name], cwd=ROOT,
                         capture_output=True, text=True)
    return out.stdout


def service_ctl(action: str, svc: str) -> None:
    if DOCKER:
        subprocess.run(["docker", "compose", action, f"{svc}-service"], cwd=ROOT, capture_output=True)
    elif action == "stop":
        os.system(f"kill $(cat {ROOT / 'var/run' / (svc + '.pid')}) 2>/dev/null")
    else:
        os.system(f"cd {ROOT} && scripts/svc.sh start {svc} >/dev/null")


def _env(key: str) -> str:
    if key in os.environ:
        return os.environ[key]
    for line in (ROOT / ".env").read_text().splitlines():
        if line.startswith(key + "="):
            return line.split("=", 1)[1].strip()
    raise SystemExit(f"{key} missing from environment/.env")


def check(name: str, cond: bool, detail: str = "") -> bool:
    results.append((bool(cond), name))
    print(f"  [{'PASS' if cond else 'FAIL'}] {name}" + (f"  -> {detail}" if not cond and detail else ""))
    return bool(cond)


def section(title: str) -> None:
    print(f"\n=== {title}")


def png_bytes(w: int = 4, h: int = 4) -> bytes:
    def chunk(t: bytes, d: bytes) -> bytes:
        c = struct.pack(">I", len(d)) + t + d
        return c + struct.pack(">I", zlib.crc32(t + d) & 0xFFFFFFFF)
    raw = b"".join(b"\x00" + b"\xff\x00\x00" * w for _ in range(h))
    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(raw)) + chunk(b"IEND", b""))


async def wait_for(fn, timeout: float = 15.0, interval: float = 0.4):
    end = time.time() + timeout
    while time.time() < end:
        val = await fn()
        if val:
            return val
        await asyncio.sleep(interval)
    return None


class Api:
    def __init__(self, base: str, token: str | None = None) -> None:
        self.base = base
        self.token = token
        self.c = httpx.AsyncClient(base_url=base, timeout=30)

    def h(self, extra: dict | None = None) -> dict:
        h = {"Authorization": f"Bearer {self.token}"} if self.token else {}
        h.update(extra or {})
        return h

    async def req(self, method: str, path: str, **kw) -> httpx.Response:
        headers = self.h(kw.pop("headers", None))
        return await self.c.request(method, path, headers=headers, **kw)

    async def get(self, p, **kw): return await self.req("GET", p, **kw)
    async def post(self, p, **kw): return await self.req("POST", p, **kw)
    async def put(self, p, **kw): return await self.req("PUT", p, **kw)
    async def patch(self, p, **kw): return await self.req("PATCH", p, **kw)
    async def delete(self, p, **kw): return await self.req("DELETE", p, **kw)


async def login(auth_url: str, email: str, password: str, **extra) -> dict:
    async with httpx.AsyncClient(base_url=auth_url, timeout=20) as c:
        r = await c.post("/api/v1/auth/token", data={"username": email, "password": password, **extra})
        r.raise_for_status()
        return r.json()


async def main(gateway: str, auth_direct: str) -> int:
    admin_email, admin_pwd = _env("BOOTSTRAP_ADMIN_EMAIL"), _env("BOOTSTRAP_ADMIN_PASSWORD")
    anon = Api(gateway)

    # ------------------------------------------------------------------ 0. platform
    section("0. Platform: health, docs, gateway routing")
    r = await anon.get("/health/services")
    check("gateway aggregates health of all 5 services (all UP)", r.status_code == 200 and r.json()["status"] == "UP", r.text[:200])
    r = await anon.get("/docs")
    check("Swagger UI served by gateway", r.status_code == 200 and "swagger-ui" in r.text)
    r = await anon.get("/redoc")
    check("ReDoc served by gateway", r.status_code == 200 and "redoc" in r.text.lower())
    spec = (await anon.get("/openapi.json")).json()
    check("merged OpenAPI contains all services", all(any(p.startswith(x) for p in spec["paths"]) for x in
          ("/api/v1/auth", "/api/v1/students", "/api/v1/courses", "/api/v1/enrollments", "/api/v1/notifications")),
          f"{len(spec['paths'])} paths")
    for svc, port in (("auth", 8001), ("student", 8002), ("course", 8003), ("enrollment", 8004), ("notification", 8005)):
        async with httpx.AsyncClient(timeout=10) as c:
            ok = (await c.get(f"http://localhost:{port}/docs")).status_code == 200 and \
                 (await c.get(f"http://localhost:{port}/redoc")).status_code == 200 and \
                 (await c.get(f"http://localhost:{port}/openapi.json")).status_code == 200
        check(f"{svc}-service serves Swagger/ReDoc/OpenAPI directly", ok)
    r = await anon.get("/api/v1/students")
    check("gateway rejects missing token with 401 + standard error body",
          r.status_code == 401 and r.json()["error"]["code"] == "UNAUTHORIZED" and "request_id" in r.json()["error"])
    r = await anon.get("/api/v1/nonexistent")
    check("gateway: unknown route -> 401 (auth first) / with token 404", r.status_code in (401, 404))
    r = await anon.get("/api/v1/students", headers={"Authorization": "Bearer not.a.jwt"})
    check("gateway rejects malformed JWT", r.status_code == 401)

    # ----------------------------------------------------------------- 1. auth
    section("1. Authentication: register, login, JWT, OAuth2, refresh, logout")
    admin_tokens = await login(auth_direct, admin_email, admin_pwd)
    admin = Api(gateway, admin_tokens["access_token"])
    check("OAuth2 password grant returns bearer+refresh tokens",
          admin_tokens["token_type"] == "bearer" and admin_tokens["expires_in"] == 900 and "users:manage" in admin_tokens["scope"])
    r = await anon.post("/api/v1/auth/register", json={"email": f"weak{RUN}@example.com", "full_name": "Weak Pw", "password": "weak"})
    check("registration rejects a weak password (422 + field detail)", r.status_code == 422 and r.json()["error"]["details"][0]["field"].endswith("password"))
    check("validation error does not echo the submitted password", "weak" not in json.dumps([d.get("input") for d in r.json()["error"]["details"]]) )
    stu_email = f"student{RUN}@example.com"
    r = await anon.post("/api/v1/auth/register", json={"email": stu_email, "full_name": "Sam Student", "password": PWD})
    check("register -> 201, role STUDENT, no password in response", r.status_code == 201 and r.json()["roles"] == ["STUDENT"] and "password" not in r.text)
    stu_user_id = r.json()["id"]
    r = await anon.post("/api/v1/auth/register", json={"email": stu_email.upper(), "full_name": "Dup", "password": PWD})
    check("duplicate e-mail (case-insensitive) -> 409", r.status_code == 409)
    async with httpx.AsyncClient(base_url=auth_direct, timeout=20) as c:
        r = await c.post("/api/v1/auth/login", json={"email": stu_email, "password": "Wrong!Pass1234"})
        check("wrong password -> 401 generic message", r.status_code == 401 and r.json()["error"]["message"] == "Invalid email or password")
        r2 = await c.post("/api/v1/auth/login", json={"email": f"nobody{RUN}@example.com", "password": PWD})
        check("unknown e-mail -> identical 401 (no user enumeration)", r2.status_code == 401 and r2.json()["error"]["message"] == r.json()["error"]["message"])
        r = await c.post("/api/v1/auth/login", json={"email": stu_email, "password": PWD})
        check("JSON login works", r.status_code == 200 and r.json()["access_token"])
        stu_tokens = r.json()
    stu = Api(gateway, stu_tokens["access_token"])
    r = await stu.get("/api/v1/auth/me")
    check("GET /auth/me via gateway", r.status_code == 200 and r.json()["email"] == stu_email)

    # JWT inspection: claims
    payload = json.loads(base64.urlsafe_b64decode(stu_tokens["access_token"].split(".")[1] + "=="))
    check("JWT claims: sub/type/roles/scope/jti/iss/exp present", all(k in payload for k in ("sub", "type", "roles", "scope", "jti", "iss", "exp")) and payload["type"] == "access")
    check("student scopes do not include students:read / users:manage", "students:read" not in payload["scope"] and "users:manage" not in payload["scope"])
    # tampered token
    h, p, s = stu_tokens["access_token"].split(".")
    forged_payload = json.loads(base64.urlsafe_b64decode(p + "=="))
    forged_payload["roles"] = ["ADMIN"]
    forged = ".".join([h, base64.urlsafe_b64encode(json.dumps(forged_payload).encode()).decode().rstrip("="), s])
    r = await Api(gateway, forged).get("/api/v1/students")
    check("tampered JWT (roles=ADMIN) rejected (signature check)", r.status_code == 401)
    r = await Api(gateway, stu_tokens["refresh_token"]).get("/api/v1/auth/me")
    check("refresh token cannot be used as an access token", r.status_code == 401)

    # scopes
    narrow = await login(auth_direct, admin_email, admin_pwd, scope="students:read")
    narrow_api = Api(gateway, narrow["access_token"])
    r = await narrow_api.get("/api/v1/students?size=1")
    check("OAuth2 scope-narrowed token (students:read) can read students", r.status_code == 200)
    r = await narrow_api.post("/api/v1/departments", json={"code": "ZZ", "name": "Nope"})
    check("...but is forbidden (403) to write: scope enforcement", r.status_code == 403 and "scope" in r.json()["error"]["message"].lower())
    async with httpx.AsyncClient(base_url=auth_direct, timeout=20) as c:
        r = await c.post("/api/v1/auth/token", data={"username": admin_email, "password": admin_pwd, "scope": "bogus:scope"})
        check("unknown scope -> 400 invalid_scope", r.status_code == 400)
        r = await c.post("/api/v1/auth/token", data={"username": stu_email, "password": PWD, "scope": "users:manage"})
        check("scope not allowed for the role -> 403", r.status_code == 403)

    # refresh rotation + reuse detection
    async with httpx.AsyncClient(base_url=auth_direct, timeout=20) as c:
        t1 = stu_tokens
        r = await c.post("/api/v1/auth/refresh", json={"refresh_token": t1["refresh_token"]})
        check("refresh -> new access+refresh pair", r.status_code == 200 and r.json()["refresh_token"] != t1["refresh_token"])
        t2 = r.json()
        r = await c.post("/api/v1/auth/refresh", json={"refresh_token": t1["refresh_token"]})
        check("re-using a rotated refresh token -> 401 (theft detection)", r.status_code == 401)
        r = await c.post("/api/v1/auth/refresh", json={"refresh_token": t2["refresh_token"]})
        check("...and the whole token family is revoked", r.status_code == 401)
        r = await c.post("/api/v1/auth/refresh", json={"refresh_token": "garbage"})
        check("garbage refresh token -> 401", r.status_code == 401)

    # logout -> revocation via Kafka -> gateway
    t = await login(auth_direct, stu_email, PWD)
    s2 = Api(gateway, t["access_token"])
    check("fresh token works through gateway before logout", (await s2.get("/api/v1/auth/me")).status_code == 200)
    r = await s2.post("/api/v1/auth/logout", json={"refresh_token": t["refresh_token"]})
    check("logout -> 204", r.status_code == 204)

    async def revoked():
        return (await s2.get("/api/v1/auth/me")).status_code == 401
    check("revoked access token rejected by gateway (Kafka TokenRevoked event)", await wait_for(revoked, 10))
    async with httpx.AsyncClient(base_url=auth_direct, timeout=20) as c:
        r = await c.post("/api/v1/auth/refresh", json={"refresh_token": t["refresh_token"]})
    check("refresh token revoked at logout", r.status_code == 401)

    # change password
    t = await login(auth_direct, stu_email, PWD)
    s3 = Api(gateway, t["access_token"])
    new_pwd = "An0ther!Passw0rd#2"
    r = await s3.post("/api/v1/auth/change-password", json={"current_password": "bad", "new_password": new_pwd})
    check("change-password with wrong current password -> 401", r.status_code == 401)
    r = await s3.post("/api/v1/auth/change-password", json={"current_password": PWD, "new_password": PWD})
    check("new password equal to current -> 422 (model validator)", r.status_code == 422)
    r = await s3.post("/api/v1/auth/change-password", json={"current_password": PWD, "new_password": new_pwd})
    check("change-password -> 204", r.status_code == 204)
    async with httpx.AsyncClient(base_url=auth_direct, timeout=20) as c:
        r = await c.post("/api/v1/auth/refresh", json={"refresh_token": t["refresh_token"]})
        check("old refresh tokens revoked after password change", r.status_code == 401)
        r = await c.post("/api/v1/auth/login", json={"email": stu_email, "password": PWD})
        check("old password no longer works", r.status_code == 401)
    PWD_NOW = new_pwd

    # forgot / reset
    emails_dir = ROOT / "var" / ("compose/emails" if DOCKER else "emails")
    before = set(emails_dir.glob("*.eml"))
    r = await anon.post("/api/v1/auth/forgot-password", json={"email": stu_email})
    check("forgot-password -> 202", r.status_code == 202)
    r = await anon.post("/api/v1/auth/forgot-password", json={"email": f"ghost{RUN}@example.com"})
    check("forgot-password for unknown e-mail -> same 202 (no enumeration)", r.status_code == 202)

    async def reset_mail():
        for f in set(emails_dir.glob("*.eml")) - before:
            msg = email.message_from_bytes(f.read_bytes(), policy=email.policy.default)  # decodes QP/base64
            body = msg.get_body(preferencelist=("plain",))
            text = body.get_content() if body else ""
            if stu_email in str(msg["To"]) and "reset-password?token=" in text:
                return re.search(r"token=([A-Za-z0-9_\-]+)", text).group(1)
        return None
    token = await wait_for(reset_mail, 20)
    check("password-reset e-mail delivered (Kafka -> Notification -> file backend) with reset link", bool(token))
    r = await anon.post("/api/v1/auth/reset-password", json={"token": "x" * 30, "new_password": "Reset!Passw0rd#3"})
    check("reset with invalid token -> 400", r.status_code == 400)
    reset_pwd = "Reset!Passw0rd#3"
    r = await anon.post("/api/v1/auth/reset-password", json={"token": token, "new_password": reset_pwd})
    check("reset with e-mailed token -> 200", r.status_code == 200)
    r = await anon.post("/api/v1/auth/reset-password", json={"token": token, "new_password": "Reset!Passw0rd#4"})
    check("reset token is single-use (second use -> 400)", r.status_code == 400)
    stu_tokens = await login(auth_direct, stu_email, reset_pwd)
    stu = Api(gateway, stu_tokens["access_token"])
    check("login with the reset password works", bool(stu_tokens["access_token"]))

    # lockout
    lock_email = f"lock{RUN}@example.com"
    await anon.post("/api/v1/auth/register", json={"email": lock_email, "full_name": "Lock Test", "password": PWD})
    async with httpx.AsyncClient(base_url=auth_direct, timeout=20) as c:
        codes = [(await c.post("/api/v1/auth/login", json={"email": lock_email, "password": "Bad!Passw0rd#9"})).status_code for _ in range(5)]
        r = await c.post("/api/v1/auth/login", json={"email": lock_email, "password": PWD})
    check("5 failed logins lock the account: correct password now -> 429 + Retry-After",
          codes == [401] * 5 and r.status_code == 429 and "retry-after" in r.headers, f"{codes} {r.status_code}")

    # admin user management
    section("1b. User & role management (ADMIN)")
    teacher_email = f"teacher{RUN}@example.com"
    r = await admin.post("/api/v1/users", json={"email": teacher_email, "full_name": "Tess Teacher", "password": PWD, "roles": ["TEACHER"]})
    check("admin creates a TEACHER user", r.status_code == 201 and r.json()["roles"] == ["TEACHER"])
    teacher_id = r.json()["id"]
    r = await admin.get("/api/v1/users?role=teacher&q=Tess&sort=email&order=desc")
    check("list users with role filter + search + sort", r.status_code == 200 and any(u["id"] == teacher_id for u in r.json()["items"]))
    r = await admin.patch(f"/api/v1/users/{teacher_id}", json={"full_name": "Tess T. Teacher"})
    check("PATCH user", r.status_code == 200 and r.json()["full_name"] == "Tess T. Teacher")
    r = await admin.put(f"/api/v1/users/{stu_user_id}/roles", json={"roles": ["STUDENT", "TEACHER"]})
    check("PUT roles (replace)", r.status_code == 200 and sorted(r.json()["roles"]) == ["STUDENT", "TEACHER"])
    r = await admin.put(f"/api/v1/users/{stu_user_id}/roles", json={"roles": ["STUDENT"]})
    check("roles restored", r.json()["roles"] == ["STUDENT"])
    r = await admin.get("/api/v1/roles")
    check("GET /roles lists scopes + user counts", r.status_code == 200 and {x["name"] for x in r.json()} == {"ADMIN", "TEACHER", "STUDENT"})
    r = await stu.get("/api/v1/users")
    check("RBAC: STUDENT cannot list users (403)", r.status_code == 403)
    me = (await admin.get("/api/v1/auth/me")).json()
    r = await admin.delete(f"/api/v1/users/{me['id']}")
    check("admin cannot delete own account (409)", r.status_code == 409)
    r = await admin.patch(f"/api/v1/users/{me['id']}", json={"is_active": False})
    check("cannot deactivate the last active admin (409)", r.status_code == 409)
    r = await admin.get("/api/v1/users/999999")
    check("unknown user -> 404 standard error", r.status_code == 404 and r.json()["error"]["code"] == "NOT_FOUND")

    teacher_tokens = await login(auth_direct, teacher_email, PWD)
    teacher = Api(gateway, teacher_tokens["access_token"])

    # -------------------------------------------------------------- 2. students
    section("2. Student service: CRUD, search, pagination, relations")
    dept_code = f"D{RUN[:4]}".upper()
    r = await admin.post("/api/v1/departments", json={"code": dept_code.lower(), "name": f"Dept {RUN}"})
    check("create department (code upper-cased)", r.status_code == 201 and r.json()["code"] == dept_code)
    r = await admin.post("/api/v1/departments", json={"code": dept_code, "name": f"Other {RUN}"})
    check("duplicate department -> 409", r.status_code == 409)
    body = {"first_name": "Grace", "last_name": "Hopper", "email": f"grace{RUN}@example.com", "date_of_birth": "2000-12-09",
            "gender": "FEMALE", "department_code": dept_code, "gpa": "3.90",
            "profile": {"city": "Arlington", "bio": "Compilers"},
            "contacts": [{"contact_type": "PHONE", "value": "+1 555 010 9999", "is_primary": True},
                         {"contact_type": "EMERGENCY", "value": "(555) 010-1234", "label": "Mother"}],
            "interests": ["Compilers", "Navy"]}
    r = await teacher.post("/api/v1/students", json=body)
    check("TEACHER creates a student (201) with nested profile/contacts/interests",
          r.status_code == 201 and r.json()["profile"]["city"] == "Arlington" and len(r.json()["contacts"]) == 2 and r.json()["interests"] == ["compilers", "navy"], r.text[:300])
    grace = r.json()
    check("student number generated (STU<year><id>)", re.fullmatch(r"STU\d{4}\d{6}", grace["student_number"]) is not None)
    r = await teacher.post("/api/v1/students", json=body)
    check("duplicate student e-mail -> 409", r.status_code == 409)
    bad = dict(body, email="not-an-email", first_name="X1", date_of_birth="2999-01-01")
    r = await teacher.post("/api/v1/students", json=bad)
    check("invalid payload -> 422 with several field errors", r.status_code == 422 and len(r.json()["error"]["details"]) >= 3)
    r = await teacher.post("/api/v1/students", json=dict(body, email=f"x{RUN}@example.com", department_code="NOPE"))
    check("unknown department -> 422", r.status_code == 422)
    r = await teacher.get(f"/api/v1/students/{grace['id']}")
    check("GET student by id", r.status_code == 200 and r.json()["email"] == grace["email"])
    r = await teacher.put(f"/api/v1/students/{grace['id']}", json={"first_name": "Grace", "last_name": "Hopper-Murray", "email": grace["email"], "status": "ACTIVE", "admission_date": grace["admission_date"], "department_code": dept_code, "gpa": "3.95"})
    check("PUT (full replace) updates fields", r.status_code == 200 and r.json()["last_name"] == "Hopper-Murray" and r.json()["gpa"] == "3.95" and r.json()["gender"] is None)
    r = await teacher.patch(f"/api/v1/students/{grace['id']}", json={"gender": "FEMALE", "profile": {"city": "New York"}})
    check("PATCH updates only supplied fields (+ nested profile merge)", r.status_code == 200 and r.json()["gender"] == "FEMALE" and r.json()["profile"]["city"] == "New York" and r.json()["profile"]["bio"] == "Compilers")
    r = await teacher.post(f"/api/v1/students/{grace['id']}/contacts", json={"contact_type": "ALTERNATE_EMAIL", "value": f"g2{RUN}@example.com"})
    check("add contact", r.status_code == 201 and len(r.json()["contacts"]) == 3)
    cid = r.json()["contacts"][-1]["id"]
    r = await teacher.post(f"/api/v1/students/{grace['id']}/contacts", json={"contact_type": "ALTERNATE_EMAIL", "value": f"g2{RUN}@example.com"})
    check("duplicate contact -> 409", r.status_code == 409)
    r = await teacher.delete(f"/api/v1/students/{grace['id']}/contacts/{cid}")
    check("delete contact -> 204", r.status_code == 204)
    r = await teacher.put(f"/api/v1/students/{grace['id']}/interests", json={"interests": ["Compilers", "COBOL", "Sailing"]})
    check("PUT interests (many-to-many replace)", r.status_code == 200 and r.json()["interests"] == ["cobol", "compilers", "sailing"])

    names = ["Alan", "Barbara", "Claude", "Donald", "Edsger"]
    bulk = {"students": [{"first_name": n, "last_name": "Bulk", "email": f"{n.lower()}{RUN}@example.com", "department_code": dept_code, "gpa": g}
                         for n, g in zip(names, ["2.50", "3.10", "3.60", "2.00", "4.00"])]}
    r = await admin.post("/api/v1/students/bulk", json=bulk)
    check("bulk import (single transaction) -> 201 x5", r.status_code == 201 and len(r.json()) == 5)
    r = await admin.post("/api/v1/students/bulk", json=bulk)
    check("bulk import rejects already-registered e-mails (409, nothing inserted)", r.status_code == 409)
    r = await teacher.post("/api/v1/students/bulk", json=bulk)
    check("RBAC: TEACHER cannot bulk import (403)", r.status_code == 403)
    ids = [s["id"] for s in (await admin.post("/api/v1/students/bulk", json={"students": [dict(bulk["students"][0], email=f"zz{RUN}@example.com")]})).json()]
    r = await admin.patch("/api/v1/students/bulk/status", json={"ids": ids, "status": "SUSPENDED"})
    check("bulk status update (one UPDATE)", r.status_code == 200 and r.json()["affected"] == 1)

    r = await teacher.get(f"/api/v1/students?department={dept_code}&sort=gpa&order=desc&size=3&page=1")
    d = r.json()
    check("list: filter by department + sort gpa desc + pagination", r.status_code == 200 and d["size"] == 3 and len(d["items"]) == 3 and d["total"] >= 6 and d["pages"] >= 2
          and [float(i["gpa"]) for i in d["items"]] == sorted([float(i["gpa"]) for i in d["items"]], reverse=True))
    r = await teacher.get(f"/api/v1/students?department={dept_code}&sort=gpa&order=desc&size=3&page=2")
    check("pagination page 2 differs from page 1", r.status_code == 200 and {i["id"] for i in r.json()["items"]}.isdisjoint({i["id"] for i in d["items"]}))
    r = await teacher.get(f"/api/v1/students?q=hopper&department={dept_code}")
    check("search by name", r.status_code == 200 and r.json()["total"] == 1)
    r = await teacher.get(f"/api/v1/students?department={dept_code}&status=SUSPENDED")
    check("filter by status", r.json()["total"] == 1)
    r = await teacher.get(f"/api/v1/students?department={dept_code}&min_gpa=3.5&max_gpa=3.99")
    check("filter by GPA range", r.json()["total"] == 2, r.text[:200])
    r = await teacher.get("/api/v1/students?sort=password")
    check("sorting by a non-whitelisted field -> 400", r.status_code == 400)
    r = await teacher.get("/api/v1/students?size=1000")
    check("page size above limit -> 422", r.status_code == 422)
    r = await teacher.get("/api/v1/students/stats")
    check("stats (sync endpoint, aggregation + correlated subquery)", r.status_code == 200 and r.json()["total"] >= 6 and "by_department" in r.json())
    r = await teacher.delete(f"/api/v1/students/{ids[0]}")
    check("RBAC: TEACHER cannot delete a student (403)", r.status_code == 403)
    r = await admin.delete(f"/api/v1/students/{ids[0]}")
    check("admin deletes student -> 204", r.status_code == 204)
    r = await admin.get(f"/api/v1/students/{ids[0]}")
    check("deleted student -> 404", r.status_code == 404)

    # student self-service
    r = await stu.get("/api/v1/students")
    check("RBAC: STUDENT cannot list students (403)", r.status_code == 403)
    r = await stu.get("/api/v1/students/me")
    check("STUDENT without a linked record -> /students/me 404", r.status_code == 404)
    link = await admin.post("/api/v1/students", json={"first_name": "Sam", "last_name": "Student", "email": stu_email, "department_code": dept_code, "user_id": stu_user_id})
    check("admin links a student record to the auth user", link.status_code == 201 and link.json()["user_id"] == stu_user_id)
    sam = link.json()
    r = await stu.get("/api/v1/students/me")
    check("STUDENT reads own record via /students/me", r.status_code == 200 and r.json()["id"] == sam["id"])
    r = await stu.get(f"/api/v1/students/{grace['id']}")
    check("STUDENT cannot read another student (403)", r.status_code == 403)
    r = await stu.patch("/api/v1/students/me", json={"profile": {"bio": "I like databases"}, "gpa": "4.00"})
    check("STUDENT self-patch ignores admin-only fields (gpa) but updates profile", r.status_code == 200 and r.json()["profile"]["bio"] == "I like databases" and r.json()["gpa"] is None)
    r = await stu.put(f"/api/v1/students/{sam['id']}", json={})
    check("STUDENT cannot PUT a student (403)", r.status_code == 403)

    # ------------------------------------------------------------------- 3. courses
    section("3. Course service")
    r = await admin.post("/api/v1/categories", json={"name": f"Cat {RUN}", "description": "e2e"})
    check("create category", r.status_code == 201)
    cat_id = r.json()["id"]
    r = await admin.post("/api/v1/categories", json={"name": f"Cat {RUN}"})
    check("duplicate category -> 409", r.status_code == 409)
    r = await teacher.post("/api/v1/categories", json={"name": "Teacher cat"})
    check("RBAC: TEACHER cannot create categories (403)", r.status_code == 403)
    code = f"E{LET}101"
    cbody = {"code": code, "title": "Distributed Systems", "description": "Consensus & friends", "category_id": cat_id, "credits": 4, "duration_weeks": 14, "capacity": 3, "status": "OPEN"}
    r = await teacher.post("/api/v1/courses", json=cbody)
    check("TEACHER creates a course", r.status_code == 201 and r.json()["available_seats"] == 3 and r.json()["is_available"] is True, r.text[:300])
    course = r.json()
    r = await teacher.post("/api/v1/courses", json=cbody)
    check("duplicate course code -> 409", r.status_code == 409)
    r = await teacher.post("/api/v1/courses", json=dict(cbody, code="BAD", credits=99, duration_weeks=0, end_date="2020-01-01", start_date="2021-01-01"))
    check("invalid course -> 422", r.status_code == 422)
    r = await teacher.patch(f"/api/v1/courses/{course['id']}", json={"title": "Distributed Systems II"})
    check("TEACHER may patch the course they created", r.status_code == 200 and r.json()["title"].endswith("II"))
    other = await admin.post("/api/v1/courses", json=dict(cbody, code=f"E{LET}202", title="Admin Course"))
    r = await teacher.patch(f"/api/v1/courses/{other.json()['id']}", json={"title": "Hijack"})
    check("TEACHER cannot modify a course they neither created nor teach (403)", r.status_code == 403)
    r = await admin.put(f"/api/v1/courses/{other.json()['id']}/teachers/{teacher_id}", json={"role": "ASSISTANT"})
    check("admin assigns a teacher (validated through Auth service REST call)", r.status_code == 200 and r.json()["teachers"][0]["teacher_user_id"] == teacher_id, r.text[:200])
    r = await teacher.patch(f"/api/v1/courses/{other.json()['id']}", json={"title": "Now allowed"})
    check("...assigned teacher may now modify it", r.status_code == 200)
    r = await admin.put(f"/api/v1/courses/{other.json()['id']}/teachers/{stu_user_id}")
    check("assigning a non-teacher -> 422", r.status_code == 422)
    r = await admin.put(f"/api/v1/courses/{other.json()['id']}/teachers/9999999")
    check("assigning an unknown user -> 404 (propagated from Auth service)", r.status_code == 404)
    r = await teacher.get(f"/api/v1/courses?teacher_id={teacher_id}")
    check("filter courses by teacher", r.status_code == 200 and r.json()["total"] >= 1)
    r = await teacher.get(f"/api/v1/courses?category_id={cat_id}&min_credits=3&available_only=true&sort=title&order=desc&q=Systems")
    check("filter/search/sort courses", r.status_code == 200 and r.json()["total"] >= 1)
    r = await stu.get(f"/api/v1/courses/{course['id']}")
    check("STUDENT can read courses", r.status_code == 200)
    r = await stu.put(f"/api/v1/courses/{course['id']}", json=cbody | {"status": "OPEN"})
    check("STUDENT cannot write courses (403)", r.status_code == 403)
    r = await admin.patch(f"/api/v1/courses/{other.json()['id']}/availability", json={"status": "CLOSED"})
    check("PATCH availability CLOSED", r.status_code == 200 and r.json()["is_available"] is False)

    # ----------------------------------------------------------------- 4. enrollments
    section("4. Enrollment service (sync REST validation + Kafka events)")
    async def course_state(cid):
        return (await admin.get(f"/api/v1/courses/{cid}")).json()
    async def student_state(sid):
        return (await admin.get(f"/api/v1/students/{sid}")).json()
    r = await admin.post("/api/v1/enrollments", json={"student_id": sam["id"], "course_id": course["id"]})
    check("admin enrolls student -> 201 ENROLLED with snapshots", r.status_code == 201 and r.json()["status"] == "ENROLLED" and r.json()["course_code"] == code, r.text[:300])
    enr = r.json()
    r = await admin.post("/api/v1/enrollments", json={"student_id": sam["id"], "course_id": course["id"]})
    check("duplicate enrollment -> 409", r.status_code == 409)
    r = await admin.post("/api/v1/enrollments", json={"student_id": 99999999, "course_id": course["id"]})
    check("unknown student -> 404 (Student service answered)", r.status_code == 404)
    r = await admin.post("/api/v1/enrollments", json={"student_id": sam["id"], "course_id": 99999999})
    check("unknown course -> 404 (Course service answered)", r.status_code == 404)
    r = await admin.post("/api/v1/enrollments", json={"student_id": sam["id"], "course_id": other.json()["id"]})
    check("course not OPEN -> 409", r.status_code == 409 and "not available" in r.json()["error"]["message"])
    r = await admin.post("/api/v1/enrollments", json={"course_id": course["id"]})
    check("staff must pass student_id -> 400", r.status_code == 400)

    async def counts_synced():
        c, s = await course_state(course["id"]), await student_state(sam["id"])
        return c["enrolled_count"] == 1 and s["enrolled_courses_count"] == 1
    check("Kafka StudentEnrolled updates Course.enrolled_count and Student.enrolled_courses_count", await wait_for(counts_synced, 15))

    async def enrol_mail(email_part: str):
        async def f():
            r = await admin.get("/api/v1/notifications?template=enrollment_confirmation&recipient=" + stu_email)
            return any(i["status"] == "SENT" for i in r.json().get("items", []))
        return await wait_for(f, 20)
    check("enrollment confirmation e-mail SENT", await enrol_mail(stu_email))

    # self enrolment
    r = await stu.post("/api/v1/enrollments", json={"course_id": other.json()["id"]})
    check("STUDENT self-enroll in a CLOSED course -> 409", r.status_code == 409)
    await admin.patch(f"/api/v1/courses/{other.json()['id']}/availability", json={"status": "OPEN"})
    r = await stu.post("/api/v1/enrollments", json={"course_id": other.json()["id"], "student_id": grace["id"]})
    check("STUDENT cannot enroll someone else (403)", r.status_code == 403)
    r = await stu.post("/api/v1/enrollments", json={"course_id": other.json()["id"]})
    check("STUDENT self-enrolls (student resolved through /students/me REST call)", r.status_code == 201 and r.json()["student_id"] == sam["id"], r.text[:200])
    self_enr = r.json()
    r = await stu.get("/api/v1/enrollments/me")
    check("GET /enrollments/me", r.status_code == 200 and r.json()["total"] == 2)
    r = await stu.get("/api/v1/enrollments")
    check("RBAC: STUDENT cannot list all enrollments (403)", r.status_code == 403)
    r = await stu.get(f"/api/v1/enrollments/{enr['id']}")
    check("STUDENT can read own enrollment + history", r.status_code == 200 and len(r.json()["history"]) == 1)
    r = await stu.patch(f"/api/v1/enrollments/{enr['id']}", json={"grade": "A"})
    check("STUDENT cannot grade (403)", r.status_code == 403)
    r = await teacher.patch(f"/api/v1/enrollments/{enr['id']}", json={"status": "COMPLETED"})
    check("complete without grade -> 422", r.status_code == 422)
    r = await teacher.patch(f"/api/v1/enrollments/{enr['id']}", json={"grade": "A-", "status": "COMPLETED"})
    check("TEACHER grades + completes", r.status_code == 200 and r.json()["status"] == "COMPLETED" and r.json()["grade"] == "A-")
    r = await teacher.patch(f"/api/v1/enrollments/{enr['id']}", json={"grade": "Z"})
    check("invalid grade -> 422", r.status_code == 422)
    r = await stu.post(f"/api/v1/enrollments/{enr['id']}/cancel")
    check("cannot cancel a COMPLETED enrollment (409)", r.status_code == 409)

    r = await teacher.get(f"/api/v1/enrollments/students/{sam['id']}")
    check("enrollments of one student", r.status_code == 200 and r.json()["total"] == 2)
    r = await stu.get(f"/api/v1/enrollments/students/{grace['id']}")
    check("STUDENT sees nothing for another student", r.status_code == 200 and r.json()["total"] == 0)
    r = await teacher.get(f"/api/v1/enrollments/courses/{course['id']}?status=COMPLETED")
    check("enrollments of one course (filter status)", r.status_code == 200 and r.json()["total"] == 1)

    # cancel -> counts back
    r = await stu.post(f"/api/v1/enrollments/{self_enr['id']}/cancel", json={"reason": "schedule clash"})
    check("STUDENT cancels own enrollment", r.status_code == 200 and r.json()["status"] == "CANCELLED" and r.json()["cancel_reason"] == "schedule clash")
    async def cancel_synced():
        return (await course_state(other.json()["id"]))["enrolled_count"] == 0
    check("EnrollmentCancelled event decrements Course.enrolled_count", await wait_for(cancel_synced, 15))
    r = await stu.post("/api/v1/enrollments", json={"course_id": other.json()["id"]})
    check("re-enroll after cancellation reuses the row (history grows)", r.status_code == 201 and r.json()["id"] == self_enr["id"])
    r = await admin.get(f"/api/v1/enrollments/{self_enr['id']}/history")
    check("status history: ENROLLED -> CANCELLED -> ENROLLED", [h["to_status"] for h in r.json()] == ["ENROLLED", "CANCELLED", "ENROLLED"])
    r = await admin.get("/api/v1/enrollments/stats")
    check("enrollment statistics (conditional aggregation + subquery)", r.status_code == 200 and r.json()["total"] >= 2 and r.json()["by_course"])

    # capacity + concurrency (named lock)
    cap_course = (await admin.post("/api/v1/courses", json=dict(cbody, code=f"E{LET}303", title="Capacity Race", capacity=3))).json()
    student_ids = [s["id"] for s in (await admin.post("/api/v1/students/bulk", json={"students": [
        {"first_name": "Race", "last_name": f"Runner{chr(65+i)}", "email": f"race{i}{RUN}@example.com"} for i in range(8)]})).json()]
    results_conc = await asyncio.gather(*(admin.post("/api/v1/enrollments", json={"student_id": sid, "course_id": cap_course["id"]}) for sid in student_ids))
    codes = sorted(r.status_code for r in results_conc)
    check("8 CONCURRENT enrollments for a 3-seat course -> exactly 3 succeed, 5 get 409",
          codes.count(201) == 3 and codes.count(409) == 5, str(codes))
    r = await admin.delete(f"/api/v1/courses/{course['id']}")
    check("cannot delete a course that has enrollments (409)", r.status_code == 409)

    # student deletion cancels enrollments (event driven)
    victim = student_ids[0]
    victim_enr = [r.json() for r in results_conc if r.status_code == 201]
    victim_id = victim_enr[0]["student_id"]
    r = await admin.delete(f"/api/v1/students/{victim_id}")
    check("delete a student that is enrolled -> 204", r.status_code == 204)
    async def victim_cancelled():
        e = (await admin.get(f"/api/v1/enrollments/{victim_enr[0]['id']}")).json()
        return e.get("status") == "CANCELLED" and e.get("cancel_reason") == "student deleted"
    check("StudentDeleted event cancels the student's enrollments", await wait_for(victim_cancelled, 15))
    async def seat_freed():
        return (await course_state(cap_course["id"]))["enrolled_count"] == 2
    check("...which frees the seat in the Course service", await wait_for(seat_freed, 15))

    # ---------------------------------------------------------------- 5. kafka
    section("5. Kafka: duplicates, poison messages, DLQ")
    from aiokafka import AIOKafkaConsumer, AIOKafkaProducer
    bootstrap = _env("KAFKA_BOOTSTRAP_SERVERS")
    prod = AIOKafkaProducer(bootstrap_servers=bootstrap)
    await prod.start()
    try:
        ev_id = str(uuid.uuid4())
        envelope = {"event_id": ev_id, "event_type": "NotificationRequested", "occurred_at": "2026-01-01T00:00:00Z",
                    "source": "e2e", "correlation_id": f"e2e-{RUN}", "payload": {"template": "generic_notification", "to_email": f"dup{RUN}@example.com", "to_name": "Dup", "variables": {"subject": "Dup test", "message": "once only"}}}
        for _ in range(3):  # at-least-once delivery simulated: same event_id three times
            await prod.send_and_wait("sms.notification.requests", json.dumps(envelope).encode(), key=b"dup")
        async def one_mail():
            d = (await admin.get(f"/api/v1/notifications?recipient=dup{RUN}")).json()
            return d if d["total"] >= 1 and d["items"][0]["status"] == "SENT" else None
        d = await wait_for(one_mail, 20)
        await asyncio.sleep(2)  # give any (wrong) duplicates time to appear
        d = (await admin.get(f"/api/v1/notifications?recipient=dup{RUN}")).json()
        check("same event delivered 3x -> exactly ONE notification/e-mail (idempotent consumer)", d["total"] == 1, str(d["total"]))

        # poison + unknown template -> DLQ
        dlq_consumer = AIOKafkaConsumer("sms.notification.requests.dlq", "sms.student.events.dlq", bootstrap_servers=bootstrap,
                                        group_id=None, auto_offset_reset="earliest", enable_auto_commit=False)
        await dlq_consumer.start()
        bad_id = str(uuid.uuid4())
        bad = dict(envelope, event_id=bad_id, payload={"template": "does_not_exist", "to_email": f"bad{RUN}@example.com", "variables": {}})
        await prod.send_and_wait("sms.notification.requests", json.dumps(bad).encode(), key=b"bad")
        await prod.send_and_wait("sms.student.events", b"{this is not json", key=b"poison")
        seen: dict[str, dict] = {}
        end = time.time() + 30
        while time.time() < end and len(seen) < 2:
            batch = await dlq_consumer.getmany(timeout_ms=1000)
            for tp, msgs in batch.items():
                for m in msgs:
                    hdr = {k: v.decode() for k, v in m.headers}
                    if bad_id.encode() in m.value:
                        seen["unknown_template"] = hdr
                    elif m.value == b"{this is not json":
                        seen["malformed"] = hdr
        await dlq_consumer.stop()
        check("unknown-template event retried then dead-lettered (DLQ headers: reason, source topic, attempts=3)",
              "unknown_template" in seen and seen["unknown_template"].get("dlq_attempts") == "3" and "does_not_exist" in seen["unknown_template"].get("dlq_reason", ""), str(seen.get("unknown_template")))
        check("malformed JSON dead-lettered immediately (attempts=0) by consumer group(s)", "malformed" in seen and seen["malformed"].get("dlq_attempts") == "0", str(seen.get("malformed")))
        r = await admin.get("/api/v1/auth/me")
        check("services stay healthy after poison messages", (await anon.get("/health/services")).status_code == 200)
    finally:
        await prod.stop()

    # ------------------------------------------------------------ 6. notifications
    section("6. Notification service API")
    r = await admin.get("/api/v1/notifications/templates")
    check("list templates", r.status_code == 200 and len(r.json()) == 7)
    r = await admin.post("/api/v1/notifications/preview", json={"template": "enrollment_confirmation", "variables": {"name": "<b>X</b>", "course_code": "C1", "course_title": "T"}})
    check("preview renders subject/text/html and HTML-escapes variables", r.status_code == 200 and "&lt;b&gt;" in r.json()["html"] and "<b>X</b>" in r.json()["text"])
    r = await admin.post("/api/v1/notifications/preview", json={"template": "password_reset", "variables": {"name": "x"}})
    check("preview with missing variables -> 422", r.status_code == 422)
    r = await admin.post("/api/v1/notifications", json={"to_email": f"queued{RUN}@example.com", "to_name": "Queued", "variables": {"subject": "Hello from API", "message": "Line 1\nLine 2"}})
    check("queue e-mail -> 202 Accepted", r.status_code == 202 and r.json()["status"] == "PENDING")
    nid = r.json()["id"]
    async def sent():
        d = (await admin.get(f"/api/v1/notifications/{nid}")).json()
        return d if d["status"] == "SENT" else None
    d = await wait_for(sent, 20)
    check("asynchronously delivered (SENT, attempt logged, message id stored)", bool(d) and d["attempts"] == 1 and d["attempt_log"][0]["success"] and d["provider_message_id"])
    r = await teacher.post("/api/v1/notifications", json={"to_email": "a@example.com", "variables": {"subject": "s", "message": "m"}})
    check("RBAC: TEACHER cannot queue notifications (403)", r.status_code == 403)
    r = await teacher.get("/api/v1/notifications?status=SENT&sort=id&order=desc&size=5")
    check("TEACHER can read history (filter + sort + pagination)", r.status_code == 200 and r.json()["size"] == 5)
    r = await admin.post(f"/api/v1/notifications/{nid}/retry")
    check("retry of a SENT notification -> 409", r.status_code == 409)
    r = await admin.get("/api/v1/notifications/stats")
    check("notification stats", r.status_code == 200 and r.json()["by_status"]["SENT"] >= 5)
    check("notification variables (reset links) never exposed by API", "reset_link" not in (await admin.get("/api/v1/notifications?template=password_reset")).text)

    # ------------------------------------------------------------------- 7. files
    section("7. File upload / download / validation / authorisation")
    sid = sam["id"]
    png = png_bytes()
    r = await stu.put(f"/api/v1/students/{sid}/profile-picture", files={"file": ("me.png", png, "image/png")})
    check("student uploads own profile picture", r.status_code == 200 and r.json()["content_type"] == "image/png" and r.json()["size_bytes"] == len(png), r.text[:200])
    check("API response never exposes storage key or filesystem path", "stored_key" not in r.text and "/home/" not in r.text and "var/storage" not in r.text)
    r = await stu.get(f"/api/v1/students/{sid}/profile-picture")
    check("download picture: bytes identical (sha256)", r.status_code == 200 and hashlib.sha256(r.content).hexdigest() == hashlib.sha256(png).hexdigest() and r.headers["content-type"] == "image/png")
    r = await stu.put(f"/api/v1/students/{sid}/profile-picture", files={"file": ("evil.png", b"MZ\x90\x00 this is an exe", "image/png")})
    check("MIME spoofing (exe bytes declared image/png) -> 415", r.status_code == 415)
    r = await stu.put(f"/api/v1/students/{sid}/profile-picture", files={"file": ("doc.pdf", b"%PDF-1.4 x", "application/pdf")})
    check("disallowed type for picture endpoint -> 415", r.status_code == 415)
    r = await stu.put(f"/api/v1/students/{sid}/profile-picture", files={"file": ("big.png", png + b"0" * (2 * 1024 * 1024), "image/png")})
    check("oversized upload (>2 MB) -> 413", r.status_code == 413)
    r = await stu.put(f"/api/v1/students/{sid}/profile-picture", files={"file": ("e.png", b"", "image/png")})
    check("empty file -> 400", r.status_code == 400)
    r = await stu.put(f"/api/v1/students/{sid}/profile-picture", files={"file": ("../../etc/x.exe", png, "image/png")})
    check("extension/MIME mismatch -> 415", r.status_code == 415)
    r = await stu.put(f"/api/v1/students/{sid}/profile-picture", files={"file": ("../../../tmp/evil.png", png, "image/png")})
    check("path-traversal file name is neutralised (stored under a random name; metadata keeps basename only)", r.status_code == 200 and r.json()["original_name"] == "evil.png")
    pdf = b"%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF"
    r = await stu.post(f"/api/v1/students/{sid}/documents", files={"file": ("transcript.pdf", pdf, "application/pdf")}, data={"doc_type": "TRANSCRIPT", "description": "Fall"})
    check("upload document (multipart + form fields)", r.status_code == 201 and r.json()["doc_type"] == "TRANSCRIPT")
    doc = r.json()
    r = await stu.get(f"/api/v1/students/{sid}/documents")
    check("list documents", r.status_code == 200 and len(r.json()) == 1)
    r = await stu.get(f"/api/v1/students/{sid}/documents/{doc['id']}")
    check("download document (attachment, sha header)", r.status_code == 200 and r.content == pdf and "attachment" in r.headers["content-disposition"] and r.headers["x-content-sha256"] == hashlib.sha256(pdf).hexdigest())
    r = await stu.patch(f"/api/v1/students/{sid}/documents/{doc['id']}", json={"description": "Spring"})
    check("PATCH file metadata", r.status_code == 200 and r.json()["description"] == "Spring")
    r = await Api(gateway, (await login(auth_direct, f"teacher{RUN}@example.com", PWD))["access_token"]).get(f"/api/v1/students/{sid}/documents/{doc['id']}")
    check("TEACHER may read any student's file", r.status_code == 200)
    r = await stu.get(f"/api/v1/students/{grace['id']}/documents")
    check("AUTHORISATION: student cannot list another student's files (403)", r.status_code == 403)
    r = await stu.post(f"/api/v1/students/{grace['id']}/documents", files={"file": ("a.pdf", pdf, "application/pdf")})
    check("AUTHORISATION: student cannot upload to another student (403)", r.status_code == 403)
    r = await anon.get(f"/api/v1/students/{sid}/documents/{doc['id']}")
    check("anonymous file download -> 401", r.status_code == 401)
    r = await stu.delete(f"/api/v1/students/{sid}/documents/{doc['id']}")
    check("delete document -> 204 and gone", r.status_code == 204 and (await stu.get(f"/api/v1/students/{sid}/documents/{doc['id']}")).status_code == 404)
    # course documents
    docx = b"PK\x03\x04" + b"\x00" * 40
    r = await teacher.post(f"/api/v1/courses/{course['id']}/documents", files={"file": ("syllabus.docx", docx, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")}, data={"doc_type": "SYLLABUS"})
    check("TEACHER uploads a course document (docx magic bytes verified)", r.status_code == 201, r.text[:200])
    cdoc = r.json()
    r = await stu.get(f"/api/v1/courses/{course['id']}/documents/{cdoc['id']}")
    check("STUDENT downloads a course document", r.status_code == 200 and r.content == docx)
    r = await stu.post(f"/api/v1/courses/{course['id']}/documents", files={"file": ("x.pdf", pdf, "application/pdf")})
    check("STUDENT cannot upload course documents (403)", r.status_code == 403)
    r = await teacher.delete(f"/api/v1/courses/{course['id']}/documents/{cdoc['id']}")
    check("delete course document", r.status_code == 204)
    stored = list((ROOT / "var" / ("compose/storage" if DOCKER else "storage")).rglob("*.png"))
    check("files stored under random uuid names (no client names on disk)", stored and all(re.fullmatch(r"[0-9a-f]{32}\.png", p.name) for p in stored))

    # -------------------------------------------------- 8. middleware / observability
    section("8. Middleware, correlation ids, logging, error handling")
    cid = f"{RUN}cor-id-{RUN}"  # text logs print the first 8 chars of the id
    r = await admin.get("/api/v1/students?size=1", headers={"X-Correlation-ID": cid, "X-Request-ID": f"req-{RUN}"})
    check("gateway echoes X-Correlation-ID / X-Request-ID", r.headers.get("x-correlation-id") == cid and r.headers.get("x-request-id") == f"req-{RUN}")
    check("timing + security headers present", "x-process-time-ms" in r.headers and r.headers.get("x-content-type-options") == "nosniff" and r.headers.get("x-frame-options") == "DENY")
    check("middleware execution order exposed (innermost -> outermost)", r.headers.get("x-middleware-trace", "").split(",") == ["ErrorHandling", "SecurityHeaders", "Timing", "AccessLog", "RequestContext"], r.headers.get("x-middleware-trace", ""))
    await asyncio.sleep(0.5)
    found = {svc: (cid[:8] in read_log(svc)) for svc in ("gateway", "student")}
    check("same correlation id appears in gateway AND student-service logs", all(found.values()), str(found))
    logs = "\n".join(read_log(s) for s in ("gateway", "auth", "student", "course", "enrollment", "notification"))
    check("no JWTs in any service log", "eyJ" not in logs.replace("[REDACTED_JWT]", ""))
    check("no passwords in any service log", PWD not in logs and admin_pwd not in logs and reset_pwd not in logs and new_pwd not in logs)
    r = await admin.get("/api/v1/students/abc")
    check("path validation error -> 422 standard envelope", r.status_code == 422 and r.json()["error"]["code"] == "VALIDATION_ERROR")
    r = await admin.req("DELETE", "/api/v1/auth/me")
    check("wrong method -> 405 standard envelope", r.status_code == 405 and r.json()["error"]["code"] == "METHOD_NOT_ALLOWED")
    r = await admin.get("/api/v1/doesnotexist")
    check("unknown path (authenticated) -> 404 standard envelope", r.status_code == 404 and r.json()["error"]["code"] == "NOT_FOUND")
    r = await anon.get("/api/v1/students", headers={"Origin": "http://localhost:3000"})
    check("CORS headers on allowed origin", r.headers.get("access-control-allow-origin") == "http://localhost:3000")
    r = await anon.req("OPTIONS", "/api/v1/students", headers={"Origin": "http://localhost:3000", "Access-Control-Request-Method": "POST"})
    check("CORS pre-flight handled", r.status_code == 200 and "POST" in r.headers.get("access-control-allow-methods", ""))
    r = await anon.req("OPTIONS", "/api/v1/students", headers={"Origin": "http://evil.example", "Access-Control-Request-Method": "POST"})
    check("CORS pre-flight rejects unknown origin", r.status_code == 400)

    # ------------------------------------------------------------ 9. resilience
    section("9. Resilience: downstream outage")
    service_ctl("stop", "course")
    await asyncio.sleep(2)
    t0 = time.time()
    r = await admin.get("/api/v1/courses")
    check("gateway maps a down service to 503 standard error (after bounded retries)", r.status_code == 503 and r.json()["error"]["code"] == "SERVICE_UNAVAILABLE", f"{r.status_code} {r.text[:120]}")
    check("retry/timeout budget respected (< 10 s)", time.time() - t0 < 10)
    r = await admin.post("/api/v1/enrollments", json={"student_id": sam["id"], "course_id": cap_course["id"]})
    check("Enrollment service maps Course outage to 503 (sync dependency)", r.status_code == 503, f"{r.status_code} {r.text[:150]}")
    r = await admin.get("/api/v1/students?size=1")
    check("unrelated services keep working", r.status_code == 200)
    service_ctl("start", "course")

    async def course_back():
        return (await admin.get(f"/api/v1/courses/{course['id']}")).status_code == 200
    check("service recovers after restart", bool(await wait_for(course_back, 40, 1.0)))

    # ------------------------------------------------------------------ summary
    passed = sum(1 for ok, _ in results if ok)
    print(f"\n{'=' * 60}\nRESULT: {passed}/{len(results)} checks passed")
    for ok, name in results:
        if not ok:
            print(f"  FAILED: {name}")
    return 0 if passed == len(results) else 1


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--gateway", default="http://localhost:8000")
    ap.add_argument("--docker", action="store_true", help="stack runs under docker compose (logs/e-mails/files read from containers or ./var/compose)")
    ap.add_argument("--auth", default="http://localhost:8001", help="direct auth-service URL (used to obtain tokens without consuming the gateway's login rate limit)")
    a = ap.parse_args()
    DOCKER = a.docker
    sys.exit(asyncio.run(main(a.gateway, a.auth)))
