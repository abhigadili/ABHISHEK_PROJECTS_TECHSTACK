#!/bin/sh
# Container entrypoint shared by all services.
#  1. apply this service's Alembic migrations (skipped for the gateway: it has no database)
#  2. start uvicorn
set -e
if [ -f /app/alembic.ini ]; then
  echo "[entrypoint] alembic upgrade head"
  alembic upgrade head
fi
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:?PORT not set}" --proxy-headers --no-server-header
