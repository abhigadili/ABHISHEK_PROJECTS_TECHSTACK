#!/usr/bin/env bash
# Creates one MySQL database per microservice (database-per-service). Credentials come from .env.
. "$(dirname "$0")/common.sh"
for s in "${SERVICES[@]}"; do
  db="${s##*:}"
  MYSQL_PWD="$MYSQL_PASSWORD" mysql -h"$MYSQL_HOST" -P"$MYSQL_PORT" -u"$MYSQL_USER" \
    -e "CREATE DATABASE IF NOT EXISTS \`$db\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" && echo "database $db ready"
done
