import logging

from sms_common.logging import redact


def test_redacts_jwt_bearer_and_secrets():
    jwt_like = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.abcdEFGH1234"
    assert "eyJ" not in redact(f"token was {jwt_like}")
    assert "abc123" not in redact("Authorization: Bearer abc123xyz")
    assert "hunter2" not in redact('password="hunter2" ok')
    assert "s3cr3t" not in redact("refresh_token=s3cr3t&x=1")
    assert redact("plain message") == "plain message"


def test_database_url_escapes_password(settings):
    url = settings.async_database_url()
    assert url.password == "p@ss:w/rd" and "p@ss" not in url.render_as_string(hide_password=True)
    assert url.drivername == "mysql+aiomysql" and settings.sync_database_url().drivername == "mysql+pymysql"


def test_configure_logging_adds_context(capsys):
    from sms_common.context import correlation_id_var
    from sms_common.logging import configure_logging

    configure_logging("unit", "INFO", "json")
    token = correlation_id_var.set("cid-123")
    try:
        logging.getLogger("t").info("hello %s", "world")
    finally:
        correlation_id_var.reset(token)
    out = capsys.readouterr().out
    assert '"service": "unit"' in out and '"correlation_id": "cid-123"' in out and '"message": "hello world"' in out
