from functools import lru_cache

from sms_common.config import BaseServiceSettings


class Settings(BaseServiceSettings):
    service_name: str = "enrollment-service"
    db_name: str = "StudentManagementEnrollmentDB"


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
