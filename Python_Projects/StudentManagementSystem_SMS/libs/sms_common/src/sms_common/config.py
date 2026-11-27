"""Environment-driven configuration shared by every service.

Values come from (highest priority first): real environment variables, the
project-level ``.env`` file, then the defaults below.  Secrets (database
password, JWT secret, SMTP password) have **no defaults** on purpose: a service
refuses to start when they are missing instead of silently using a weak value.
"""

from __future__ import annotations

from pathlib import Path

from pydantic import BaseModel, SecretStr, computed_field
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine import URL


def _find_env_file() -> str | None:
    """Walk up from this file to find the project's ``.env`` (local runs only)."""
    for parent in Path(__file__).resolve().parents:
        candidate = parent / ".env"
        if candidate.is_file():
            return str(candidate)
    return None


def project_root() -> Path:
    """Directory holding the project's .env (local runs) or the CWD (containers)."""
    env = _find_env_file()
    return Path(env).parent if env else Path.cwd()


def resolve_path(value: str) -> Path:
    """Relative paths are anchored at the project root, absolute ones kept as-is."""
    path = Path(value).expanduser()
    return path if path.is_absolute() else project_root() / path


class BaseServiceSettings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=_find_env_file(),
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # --- identity / runtime -------------------------------------------------
    service_name: str = "sms-service"
    environment: str = "development"  # development | test | production
    log_level: str = "INFO"
    log_format: str = "json"  # json | text
    api_prefix: str = "/api/v1"
    cors_origins: list[str] = ["http://localhost:3000", "http://localhost:5173"]

    # --- MySQL (each service sets its own ``db_name``) -----------------------
    mysql_host: str = "localhost"
    mysql_port: int = 3306
    mysql_user: str
    mysql_password: SecretStr
    db_name: str = ""
    db_pool_size: int = 10
    db_max_overflow: int = 10
    db_pool_recycle: int = 1800
    db_echo: bool = False

    # --- Kafka --------------------------------------------------------------
    kafka_bootstrap_servers: str = "localhost:9092"
    kafka_enabled: bool = True
    kafka_consumer_max_attempts: int = 3
    kafka_consumer_retry_backoff: float = 0.5
    outbox_poll_interval: float = 0.5
    outbox_batch_size: int = 100

    # --- JWT / security -----------------------------------------------------
    jwt_secret: SecretStr
    jwt_algorithm: str = "HS256"
    jwt_issuer: str = "sms-auth-service"
    access_token_ttl_minutes: int = 15
    refresh_token_ttl_days: int = 7

    # --- service discovery (inter-service REST) -----------------------------
    auth_service_url: str = "http://localhost:8001"
    student_service_url: str = "http://localhost:8002"
    course_service_url: str = "http://localhost:8003"
    enrollment_service_url: str = "http://localhost:8004"
    notification_service_url: str = "http://localhost:8005"

    # --- file storage (student + course services) ---------------------------
    storage_root: str = "var/storage"

    # --- outbound HTTP policy ----------------------------------------------
    http_connect_timeout: float = 3.0
    http_read_timeout: float = 10.0
    http_max_retries: int = 2
    http_retry_backoff: float = 0.2

    @computed_field  # type: ignore[prop-decorator]
    @property
    def is_production(self) -> bool:
        return self.environment.lower() == "production"

    def sync_database_url(self) -> URL:
        """URL for sync sessions and Alembic (PyMySQL driver)."""
        return self._url("mysql+pymysql")

    def async_database_url(self) -> URL:
        """URL for async sessions (aiomysql driver)."""
        return self._url("mysql+aiomysql")

    def server_url(self, driver: str = "mysql+pymysql") -> URL:
        """Database-less URL, used only by the database initialisation script."""
        return URL.create(
            driver,
            username=self.mysql_user,
            password=self.mysql_password.get_secret_value(),
            host=self.mysql_host,
            port=self.mysql_port,
        )

    def _url(self, driver: str) -> URL:
        # ``URL.create`` escapes special characters in the password for us.
        return URL.create(
            driver,
            username=self.mysql_user,
            password=self.mysql_password.get_secret_value(),
            host=self.mysql_host,
            port=self.mysql_port,
            database=self.db_name,
            query={"charset": "utf8mb4"},
        )


class MailSettingsMixin(BaseModel):
    """Only the notification service needs these."""

    email_backend: str = "file"  # smtp | file | console
    email_from: str = "Student Management <no-reply@sms.local>"
    smtp_host: str = "localhost"
    smtp_port: int = 1025
    smtp_username: str | None = None
    smtp_password: SecretStr | None = None
    smtp_use_tls: bool = False  # implicit TLS (port 465)
    smtp_start_tls: bool = False  # STARTTLS (port 587)
    smtp_timeout: float = 10.0
    email_file_dir: str = "var/emails"


