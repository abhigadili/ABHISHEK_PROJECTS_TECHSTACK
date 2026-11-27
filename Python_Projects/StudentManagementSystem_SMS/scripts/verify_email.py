"""Verify real SMTP delivery, delivery tracking, retry/back-off and dead-lettering.

Starts a local aiosmtpd SMTP server on :1025, restarts the notification service with
EMAIL_BACKEND=smtp (short back-off), exercises failure/recovery, then restores the
service to its normal configuration (file backend).
"""

from __future__ import annotations

import asyncio
import email
import email.policy
import os
import subprocess
import sys
import time
import uuid
from pathlib import Path

import httpx
from aiosmtpd.controller import Controller

ROOT = Path(__file__).resolve().parent.parent
GATEWAY, AUTH = "http://127.0.0.1:8000", "http://127.0.0.1:8001"
RUN = uuid.uuid4().hex[:6]
results: list[bool] = []
received: list[email.message.EmailMessage] = []


def check(name: str, ok: bool, detail: str = "") -> None:
    results.append(bool(ok))
    print(f"  [{'PASS' if ok else 'FAIL'}] {name}" + ("" if ok else f" -> {detail}"))


def env_value(key: str) -> str:
    for line in (ROOT / ".env").read_text().splitlines():
        if line.startswith(key + "="):
            return line.split("=", 1)[1]
    raise SystemExit(key)


class Handler:
    async def handle_RCPT(self, server, session, envelope, address, rcpt_options):  # noqa: N802
        if address.startswith("refused"):
            return "550 5.1.1 mailbox unavailable"
        envelope.rcpt_tos.append(address)
        return "250 OK"

    async def handle_DATA(self, server, session, envelope):  # noqa: N802
        received.append(email.message_from_bytes(envelope.content, policy=email.policy.default))
        return "250 Message accepted"


def svc(action: str, **env: str) -> None:
    subprocess.run([str(ROOT / "scripts/svc.sh"), action, "notification"], env=dict(os.environ, **env),
                   check=True, stdout=subprocess.DEVNULL)


def start_smtp() -> Controller:
    ctl = Controller(Handler(), hostname="127.0.0.1", port=1025)
    ctl.start()
    return ctl


def wait_status(c: httpx.Client, nid: int, wanted: set[str], timeout: float = 40) -> dict:
    end = time.time() + timeout
    d: dict = {}
    while time.time() < end:
        d = c.get(f"/api/v1/notifications/{nid}").json()
        if d.get("status") in wanted:
            return d
        time.sleep(0.5)
    return d


def main() -> int:
    tok = httpx.post(f"{AUTH}/api/v1/auth/token", data={"username": env_value("BOOTSTRAP_ADMIN_EMAIL"),
                                                        "password": env_value("BOOTSTRAP_ADMIN_PASSWORD")}).json()["access_token"]
    c = httpx.Client(base_url=GATEWAY, headers={"Authorization": f"Bearer {tok}"}, timeout=20)

    def queue(to: str, subject: str) -> int:
        r = c.post("/api/v1/notifications", json={"to_email": to, "to_name": "SMTP Tester",
                                                  "variables": {"subject": subject, "message": "Hello via real SMTP\nSecond line"}})
        assert r.status_code == 202, r.text
        return r.json()["id"]

    ctl = start_smtp()
    svc("restart", EMAIL_BACKEND="smtp", SMTP_HOST="127.0.0.1", SMTP_PORT="1025",
        NOTIFICATION_RETRY_BASE_SECONDS="2", NOTIFICATION_MAX_ATTEMPTS="4")
    try:
        print("=== SMTP delivery")
        nid = queue(f"smtp{RUN}@example.com", f"SMTP check {RUN}")
        d = wait_status(c, nid, {"SENT", "DEAD"})
        check("e-mail delivered through a real SMTP server (status SENT, 1 attempt)", d["status"] == "SENT" and d["attempts"] == 1, str(d))
        msg = next((m for m in received if m["Subject"] == f"SMTP check {RUN}"), None)
        check("SMTP server received the message", msg is not None)
        if msg:
            kinds = [p.get_content_type() for p in msg.iter_parts()]
            check("multipart/alternative with text/plain + text/html parts", msg.get_content_type() == "multipart/alternative" and kinds == ["text/plain", "text/html"], str(kinds))
            check("headers: From / To / Message-ID present", "no-reply@sms.local" in msg["From"] and f"smtp{RUN}@example.com" in msg["To"] and msg["Message-ID"])
            check("dynamic variables rendered in text part", "Hello via real SMTP" in msg.get_body(("plain",)).get_content())
            check("HTML part uses the shared layout", "Student Management System" in msg.get_body(("html",)).get_content())
        check("delivery tracking: message id stored, variables scrubbed after send", bool(d.get("provider_message_id")))

        print("=== Transient failure -> retry with back-off -> recovery")
        ctl.stop()
        nid = queue(f"retry{RUN}@example.com", f"Retry check {RUN}")
        d = wait_status(c, nid, {"FAILED"})
        check("SMTP down -> status FAILED, attempts=1, error recorded, next attempt scheduled",
              d["status"] == "FAILED" and d["attempts"] == 1 and "SMTP" in (d["last_error"] or ""), str(d))
        ctl = start_smtp()
        d = wait_status(c, nid, {"SENT", "DEAD"}, 40)
        check("after SMTP recovers the retry succeeds (SENT, attempts>=2)", d["status"] == "SENT" and d["attempts"] >= 2, str(d))
        check("attempt log shows failure(s) then success", [a["success"] for a in d["attempt_log"]][-1] is True and d["attempt_log"][0]["success"] is False)

        print("=== Retries exhausted -> DEAD -> manual retry")
        ctl.stop()
        nid = queue(f"dead{RUN}@example.com", f"Dead check {RUN}")
        d = wait_status(c, nid, {"DEAD"}, 60)
        check("after max_attempts (4) the notification is DEAD", d["status"] == "DEAD" and d["attempts"] == 4, str(d))
        ctl = start_smtp()
        r = c.post(f"/api/v1/notifications/{nid}/retry")
        check("POST /notifications/{id}/retry -> 202", r.status_code == 202)
        d = wait_status(c, nid, {"SENT"}, 30)
        check("manual retry delivers it", d["status"] == "SENT", str(d))

        print("=== Permanent failure (recipient refused)")
        nid = queue(f"refused{RUN}@example.com", f"Refused check {RUN}")
        d = wait_status(c, nid, {"DEAD", "SENT"}, 30)
        check("550 recipient refused -> DEAD immediately (no pointless retries)", d["status"] == "DEAD" and d["attempts"] == 1, str(d))
    finally:
        ctl.stop()
        svc("restart")  # back to the default (file backend)
    print(f"\nRESULT: {sum(results)}/{len(results)} checks passed")
    return 0 if all(results) else 1


if __name__ == "__main__":
    sys.exit(main())
