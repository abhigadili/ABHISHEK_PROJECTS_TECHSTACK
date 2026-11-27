from functools import lru_cache

from pydantic import SecretStr

from sms_common.config import BaseServiceSettings


class Settings(BaseServiceSettings):
    service_name: str = "auth-service"
    db_name: str = "StudentManagementAuthDB"

    # first-run admin (created only when the users table is empty)
    bootstrap_admin_email: str | None = None
    bootstrap_admin_password: SecretStr | None = None
    bootstrap_admin_name: str = "System Administrator"

    # brute-force protection (per account; the gateway also rate-limits per IP)
    max_failed_logins: int = 5
    lockout_minutes: int = 5

    password_reset_ttl_minutes: int = 30
    frontend_url: str = "http://localhost:3000"

    # Optional external OpenID Connect provider (disabled unless issuer+client set)
    oidc_issuer: str | None = None
    oidc_client_id: str | None = None
    oidc_client_secret: SecretStr | None = None
    oidc_redirect_uri: str = "http://localhost:8000/api/v1/auth/oidc/callback"

    @property
    def oidc_enabled(self) -> bool:
        return bool(self.oidc_issuer and self.oidc_client_id and self.oidc_client_secret)


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
