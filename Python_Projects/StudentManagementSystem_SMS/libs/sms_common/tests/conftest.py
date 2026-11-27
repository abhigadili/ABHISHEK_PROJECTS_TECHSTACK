import pytest

from sms_common.config import BaseServiceSettings


@pytest.fixture
def settings() -> BaseServiceSettings:
    return BaseServiceSettings(mysql_user="u", mysql_password="p@ss:w/rd", jwt_secret="x" * 40, db_name="db")
