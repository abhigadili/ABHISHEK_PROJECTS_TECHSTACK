from functools import lru_cache

from sms_common.config import BaseServiceSettings, MailSettingsMixin


class Settings(BaseServiceSettings, MailSettingsMixin):
    service_name: str = "notification-service"
    db_name: str = "StudentManagementNotificationDB"

    notification_max_attempts: int = 5
    notification_retry_base_seconds: float = 5.0   # 5s, 10s, 20s, 40s ...
    notification_poll_interval: float = 2.0
    notification_concurrency: int = 5
    notification_stuck_after_seconds: int = 120    # reclaim SENDING rows after a crash


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
