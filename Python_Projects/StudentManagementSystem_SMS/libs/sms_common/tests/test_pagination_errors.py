import pytest
from sqlalchemy import Column, Integer, String, select
from sqlalchemy.orm import declarative_base

from sms_common.errors import BadRequestError, error_body
from sms_common.pagination import Page, PageParams, apply_sort

B = declarative_base()


class Row(B):
    __tablename__ = "rows"
    id = Column(Integer, primary_key=True)
    name = Column(String)


def test_page_math():
    p = Page.build(["a"], total=45, params=PageParams(page=2, size=20))
    assert (p.pages, p.page, p.size, p.total) == (3, 2, 20, 45)
    assert Page.build([], 0, PageParams()).pages == 0
    assert PageParams(page=3, size=10).offset == 20


def test_sort_whitelist_blocks_injection():
    cols = {"id": Row.id, "name": Row.name}
    sql = str(apply_sort(select(Row), PageParams(sort="name", order="desc"), cols, "id"))
    assert "ORDER BY rows.name DESC, rows.id ASC" in sql
    with pytest.raises(BadRequestError):
        apply_sort(select(Row), PageParams(sort="name; DROP TABLE rows"), cols, "id")


def test_error_envelope_shape():
    body = error_body("NOT_FOUND", "nope", "/x")["error"]
    assert set(body) == {"code", "message", "details", "request_id", "correlation_id", "timestamp", "path"}
