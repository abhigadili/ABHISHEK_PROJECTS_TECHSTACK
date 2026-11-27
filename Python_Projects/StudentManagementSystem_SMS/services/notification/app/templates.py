"""Reusable e-mail templates (Jinja2): one subject + HTML + plain-text file per template."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

from jinja2 import Environment, FileSystemLoader, StrictUndefined, TemplateError, select_autoescape
from jinja2.sandbox import SandboxedEnvironment

TEMPLATE_DIR = Path(__file__).parent / "templates" / "email"


@dataclass(frozen=True, slots=True)
class TemplateSpec:
    name: str
    subject: str                      # Jinja string, can use the template variables
    required: tuple[str, ...]         # variables that must be present
    description: str


REGISTRY: dict[str, TemplateSpec] = {s.name: s for s in [
    TemplateSpec("user_registered", "Welcome to Student Management, {{ name }}!", ("name",),
                 "Sent after a user account is created"),
    TemplateSpec("student_registered", "Your student record {{ student_number }} is ready",
                 ("name", "student_number"), "Sent when a student record is created"),
    TemplateSpec("enrollment_confirmation", "Enrollment confirmed: {{ course_code }} - {{ course_title }}",
                 ("name", "course_code", "course_title"), "Sent when a student is enrolled"),
    TemplateSpec("enrollment_cancelled", "Enrollment cancelled: {{ course_code }}",
                 ("name", "course_code", "course_title"), "Sent when an enrollment is cancelled"),
    TemplateSpec("password_reset", "Reset your password", ("name", "reset_link", "expires_minutes"),
                 "Password-reset link"),
    TemplateSpec("password_changed", "Your password was changed", ("name",),
                 "Security notice after a password change/reset"),
    TemplateSpec("generic_notification", "{{ subject }}", ("subject", "message"),
                 "Free-form message queued by an administrator"),
]}


class TemplateError_(Exception):  # noqa: N801
    """Template missing or variables incomplete (permanent - retrying cannot help)."""


class TemplateRenderer:
    def __init__(self) -> None:
        loader = FileSystemLoader(str(TEMPLATE_DIR))
        # HTML is auto-escaped (variables can never inject markup); text/subject are not.
        self._html = Environment(loader=loader, autoescape=select_autoescape(["html", "j2"], default=True),
                                 undefined=StrictUndefined)
        self._text = Environment(loader=loader, autoescape=False, undefined=StrictUndefined)
        self._subject = SandboxedEnvironment(autoescape=False, undefined=StrictUndefined)

    @staticmethod
    def spec(name: str) -> TemplateSpec:
        try:
            return REGISTRY[name]
        except KeyError as exc:
            raise TemplateError_(f"Unknown template '{name}'") from exc

    def validate(self, name: str, variables: dict[str, Any]) -> TemplateSpec:
        spec = self.spec(name)
        missing = [k for k in spec.required if k not in variables]
        if missing:
            raise TemplateError_(f"Template '{name}' is missing variable(s): {', '.join(missing)}")
        return spec

    def render(self, name: str, variables: dict[str, Any]) -> tuple[str, str, str]:
        """Returns (subject, text, html)."""
        spec = self.validate(name, variables)
        try:
            subject = " ".join(self._subject.from_string(spec.subject).render(**variables).split())
            text = self._text.get_template(f"{name}.txt.j2").render(**variables)
            html = self._html.get_template(f"{name}.html.j2").render(**variables)
        except TemplateError as exc:
            raise TemplateError_(f"Cannot render '{name}': {exc}") from exc
        return subject[:200], text, html
