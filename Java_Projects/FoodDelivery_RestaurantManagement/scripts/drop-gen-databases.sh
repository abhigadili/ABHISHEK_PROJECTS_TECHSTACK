#!/usr/bin/env bash
# Removes the throw-away "<db>_gen" databases that scripts/gen-schema.sh creates. (Never touches the real databases.)
. "$(dirname "$0")/common.sh"
for s in "${SERVICES[@]}"; do db="${s##*:}_gen"
  MYSQL_PWD="$MYSQL_PASSWORD" mysql -h"$MYSQL_HOST" -P"$MYSQL_PORT" -u"$MYSQL_USER" -e "DROP DATABASE IF EXISTS \`$db\`;" && echo "dropped $db"
done
