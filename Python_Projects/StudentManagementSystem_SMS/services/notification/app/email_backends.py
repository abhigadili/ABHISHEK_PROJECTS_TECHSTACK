"""E-mail delivery backends behind one abstract interface (strategy pattern).

* ``file``    (default) - writes RFC-822 ``.eml`` files; no server or credentials needed.
* ``console`` - logs recipient + subject only (bodies may contain reset links).
* ``smtp``    - real SMTP via aiosmtplib (STARTTLS / implicit TLS, optional auth).
"""

from __future__ import annotations

import asyncio
import logging
import uuid
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from email.message import EmailMessage
from email.utils import make_msgid
from pathlib import Path

import aiosmtplib

from app.config import Settings
from sms_common.config import resolve_path
from sms_common.errors import EmailDeliveryError

log = logging.getLogger(__name__)


class EmailBackend(ABC):
    """Abstraction: ``send`` returns a provider message id or raises EmailDeliveryError."""

    name = "abstract"

    @abstractmethod
    async def send(self, message: EmailMessage) -> str: ...

    async def healthy(self) -> bool:
        return True


class FileBackend(EmailBackend):
    name = "file"

    def __init__(self, directory: str) -> None:
        self.dir = resolve_path(directory)
        self.dir.mkdir(parents=True, exist_ok=True)

    async def send(self, message: EmailMessage) -> str:
        stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S")
        path = self.dir / f"{stamp}-{uuid.uuid4().hex[:8]}.eml"
        try:
            await asyncio.to_thread(path.write_bytes, bytes(message))
        except OSError as exc:
            raise EmailDeliveryError(f"cannot write {path.name}: {exc.__class__.__name__}") from exc
        return str(message["Message-ID"])


class ConsoleBackend(EmailBackend):
    name = "console"

    async def send(self, message: EmailMessage) -> str:
        log.info("EMAIL to=%s subject=%r", message["To"], message["Subject"])
        return str(message["Message-ID"])


class SmtpBackend(EmailBackend):
    name = "smtp"

    def __init__(self, s: Settings) -> None:
        self.s = s

    async def send(self, message: EmailMessage) -> str:
        s = self.s
        try:
            await aiosmtplib.send(
                message, hostname=s.smtp_host, port=s.smtp_port,
                username=s.smtp_username,
                password=s.smtp_password.get_secret_value() if s.smtp_password else None,
                use_tls=s.smtp_use_tls, start_tls=s.smtp_start_tls or None, timeout=s.smtp_timeout,
            )
        except aiosmtplib.SMTPRecipientsRefused as exc:
            raise EmailDeliveryError("recipient refused by SMTP server", permanent=True) from exc
        except aiosmtplib.SMTPAuthenticationError as exc:
            raise EmailDeliveryError(f"SMTP authentication failed: {exc.code}") from exc
        except (aiosmtplib.SMTPException, OSError, asyncio.TimeoutError) as exc:
            raise EmailDeliveryError(f"SMTP error: {exc.__class__.__name__}: {exc}"[:300]) from exc
        return str(message["Message-ID"])

    async def healthy(self) -> bool:
        try:
            client = aiosmtplib.SMTP(hostname=self.s.smtp_host, port=self.s.smtp_port, timeout=3,
                                     use_tls=self.s.smtp_use_tls)
            await client.connect()
            await client.quit()
            return True
        except Exception:
            return False


def build_backend(s: Settings) -> EmailBackend:
    kind = s.email_backend.lower()
    if kind == "smtp":
        return SmtpBackend(s)
    if kind == "console":
        return ConsoleBackend()
    if kind == "file":
        return FileBackend(s.email_file_dir)
    raise ValueError(f"Unknown EMAIL_BACKEND '{s.email_backend}' (use smtp | file | console)")


def build_message(*, sender: str, to_email: str, to_name: str | None, subject: str, text: str,
                  html: str, correlation_id: str | None = None) -> EmailMessage:
    msg = EmailMessage()
    msg["From"] = sender
    msg["To"] = f"{to_name} <{to_email}>" if to_name and "," not in to_name and '"' not in to_name else to_email
    msg["Subject"] = subject
    msg["Message-ID"] = make_msgid(domain="sms.local")
    msg["Date"] = datetime.now(timezone.utc).strftime("%a, %d %b %Y %H:%M:%S +0000")
    if correlation_id and correlation_id != "-":
        msg["X-Correlation-ID"] = correlation_id
    msg.set_content(text)                       # text/plain part
    msg.add_alternative(html, subtype="html")   # text/html alternative
    return msg
