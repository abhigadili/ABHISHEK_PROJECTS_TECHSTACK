"""Static routing table: URL prefix -> downstream service (resolved from configuration)."""

from __future__ import annotations

from dataclasses import dataclass

from app.config import Settings


@dataclass(frozen=True, slots=True)
class Route:
    prefix: str
    service: str
    base_url: str


def build_routes(s: Settings) -> list[Route]:
    p = s.api_prefix
    table = [
        (f"{p}/auth", "auth-service", s.auth_service_url),
        (f"{p}/users", "auth-service", s.auth_service_url),
        (f"{p}/roles", "auth-service", s.auth_service_url),
        (f"{p}/students", "student-service", s.student_service_url),
        (f"{p}/departments", "student-service", s.student_service_url),
        (f"{p}/courses", "course-service", s.course_service_url),
        (f"{p}/categories", "course-service", s.course_service_url),
        (f"{p}/enrollments", "enrollment-service", s.enrollment_service_url),
        (f"{p}/notifications", "notification-service", s.notification_service_url),
    ]
    return [Route(prefix, service, url.rstrip("/")) for prefix, service, url in table]


def resolve(routes: list[Route], path: str) -> Route | None:
    for r in routes:
        if path == r.prefix or path.startswith(r.prefix + "/"):
            return r
    return None


def service_urls(s: Settings) -> dict[str, str]:
    return {
        "auth-service": s.auth_service_url, "student-service": s.student_service_url,
        "course-service": s.course_service_url, "enrollment-service": s.enrollment_service_url,
        "notification-service": s.notification_service_url,
    }
