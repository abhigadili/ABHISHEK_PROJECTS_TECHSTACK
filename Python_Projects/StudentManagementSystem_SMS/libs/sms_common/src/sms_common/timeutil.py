"""Time helpers.  The databases store naive UTC datetimes (MySQL DATETIME)."""

from datetime import datetime, timezone


def utcnow() -> datetime:
    """Naive UTC 'now' matching what we store in DATETIME columns."""
    return datetime.now(timezone.utc).replace(tzinfo=None)
