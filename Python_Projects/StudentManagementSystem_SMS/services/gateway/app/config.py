from functools import lru_cache

from pydantic import SecretStr

from sms_common.config import BaseServiceSettings


class Settings(BaseServiceSettings):
    service_name: str = "api-gateway"
    # The gateway has no database; the inherited fields are neutralised.
    mysql_user: str = ""
    mysql_password: SecretStr = SecretStr("")

    rate_limit_default: str = "120/minute"   # per authenticated user (or IP when anonymous)
    rate_limit_auth: str = "20/minute"       # per IP, all /auth/* endpoints
    rate_limit_login: str = "5/minute"       # per IP, credential-checking endpoints
    trust_forwarded_for: bool = False        # honour X-Forwarded-For from a trusted reverse proxy

    proxy_connect_timeout: float = 3.0
    proxy_read_timeout: float = 30.0         # uploads/downloads can take a while
    proxy_max_retries: int = 2               # idempotent, body-less requests only


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
