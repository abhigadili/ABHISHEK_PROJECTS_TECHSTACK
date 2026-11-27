import pytest

from app.email_backends import FileBackend, build_message
from app.templates import REGISTRY, TemplateError_, TemplateRenderer

r = TemplateRenderer()
SAMPLE = {
    "user_registered": {"name": "Ann", "email": "ann@x.com"},
    "student_registered": {"name": "Ann", "student_number": "STU1", "department_code": "CS"},
    "enrollment_confirmation": {"name": "Ann", "course_code": "C1", "course_title": "Intro"},
    "enrollment_cancelled": {"name": "Ann", "course_code": "C1", "course_title": "Intro", "reason": "clash"},
    "password_reset": {"name": "Ann", "reset_link": "http://x/reset?token=abc", "expires_minutes": 30},
    "password_changed": {"name": "Ann"},
    "generic_notification": {"name": "Ann", "subject": "Hi", "message": "Body"},
}


@pytest.mark.parametrize("name", sorted(REGISTRY))
def test_every_template_renders_text_and_html(name):
    subject, text, html = r.render(name, SAMPLE[name])
    assert subject and "Ann" in text and "<html" in html and "Ann" in html


def test_html_escapes_but_text_does_not():
    _, text, html = r.render("generic_notification", {**SAMPLE["generic_notification"], "message": "<script>x</script>"})
    assert "<script>" in text and "<script>" not in html and "&lt;script&gt;" in html


def test_missing_variable_and_unknown_template_are_permanent_errors():
    with pytest.raises(TemplateError_, match="missing"):
        r.render("password_reset", {"name": "x"})
    with pytest.raises(TemplateError_, match="Unknown"):
        r.render("nope", {})


def test_subject_is_sandboxed_single_line():
    subject, _, _ = r.render("generic_notification", {**SAMPLE["generic_notification"], "subject": "A\nB"})
    assert subject == "A B"


async def test_file_backend_writes_parseable_eml(tmp_path):
    import email
    import email.policy

    msg = build_message(sender="s@x", to_email="t@x.com", to_name="T", subject="S", text="plain", html="<p>h</p>")
    mid = await FileBackend(str(tmp_path)).send(msg)
    parsed = email.message_from_bytes(next(tmp_path.glob("*.eml")).read_bytes(), policy=email.policy.default)
    assert parsed["Subject"] == "S" and mid == parsed["Message-ID"]
    assert [p.get_content_type() for p in parsed.iter_parts()] == ["text/plain", "text/html"]
