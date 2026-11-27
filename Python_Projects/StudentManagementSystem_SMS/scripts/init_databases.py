"""Create the five service databases (idempotent, never drops or alters existing ones).

Usage:  python scripts/init_databases.py
Credentials come from the environment / .env (MYSQL_USER, MYSQL_PASSWORD, ...).
"""

from __future__ import annotations

import sys

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy import create_engine, text
from sqlalchemy.engine import URL

from sms_common.config import _find_env_file

DATABASES = [
    "StudentManagementAuthDB",
    "StudentManagementStudentDB",
    "StudentManagementCourseDB",
    "StudentManagementEnrollmentDB",
    "StudentManagementNotificationDB",
]


class Cfg(BaseSettings):
    model_config = SettingsConfigDict(env_file=_find_env_file(), extra="ignore")
    mysql_host: str = "localhost"
    mysql_port: int = 3306
    mysql_user: str
    mysql_password: SecretStr


def main() -> int:
    cfg = Cfg()
    url = URL.create("mysql+pymysql", username=cfg.mysql_user,
                     password=cfg.mysql_password.get_secret_value(),
                     host=cfg.mysql_host, port=cfg.mysql_port)
    engine = create_engine(url, isolation_level="AUTOCOMMIT")
    with engine.connect() as conn:
        for name in DATABASES:
            existed = conn.execute(
                text("SELECT COUNT(*) FROM information_schema.schemata WHERE schema_name = :n"),
                {"n": name},
            ).scalar_one()
            # Identifier comes from the constant list above, never from user input.
            conn.execute(text(
                f"CREATE DATABASE IF NOT EXISTS `{name}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
            ))
            print(f"{'exists  ' if existed else 'created '} {name}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
