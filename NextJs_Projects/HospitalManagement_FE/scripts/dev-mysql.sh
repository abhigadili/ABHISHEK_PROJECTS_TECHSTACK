#!/usr/bin/env bash
# Optional helper: start a throw-away LOCAL MySQL 8 on 127.0.0.1:3307 (data in ./.mysql-dev) and create the `hospital_fe` database.
# Use it when you do not want to point the app at an existing MySQL server. Then set
#   DATABASE_URL=mysql://root@127.0.0.1:3307/hospital_fe
set -euo pipefail
DIR="$(cd "$(dirname "$0")/.." && pwd)/.mysql-dev"
if [ ! -d "$DIR/data/mysql" ]; then mkdir -p "$DIR" && mysqld --no-defaults --initialize-insecure --datadir="$DIR/data"; fi
nohup mysqld --no-defaults --datadir="$DIR/data" --port=3307 --socket="$DIR/mysql.sock" --mysqlx=OFF --bind-address=127.0.0.1 --pid-file="$DIR/mysqld.pid" --log-error="$DIR/mysqld.log" >/dev/null 2>&1 &
for _ in $(seq 1 30); do mysql -uroot --socket="$DIR/mysql.sock" -e "SELECT 1" >/dev/null 2>&1 && break; sleep 1; done
mysql -uroot --socket="$DIR/mysql.sock" -e "CREATE DATABASE IF NOT EXISTS hospital_fe CHARACTER SET utf8mb4;"
echo "MySQL ready on 127.0.0.1:3307 (stop it with: kill \$(cat $DIR/mysqld.pid))"
