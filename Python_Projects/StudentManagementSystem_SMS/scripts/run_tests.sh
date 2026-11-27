#!/usr/bin/env bash
# Unit tests (no running stack required).  Each service runs in its own pytest process because
# every service's package is called ``app``.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; PY="$ROOT/.venv/bin/python"
for dir in libs/sms_common services/auth services/notification; do
  echo "== $dir"; (cd "$ROOT/$dir" && "$PY" -m pytest -q -p no:cacheprovider)
done
