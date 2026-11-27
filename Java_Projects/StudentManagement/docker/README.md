# Docker notes – connecting containers to the EXISTING host MySQL

MySQL is **not** containerised. On this machine it listens on `127.0.0.1:3306` only and the user is `abhig@localhost`, so a container cannot reach it through `host.docker.internal`. Pick **one** option:

## Option A – make MySQL reachable from the docker subnet (production-like; needs sudo and a MySQL restart)
```bash
sudo sed -i 's/^bind-address.*/bind-address = 0.0.0.0/' /etc/mysql/mysql.conf.d/mysqld.cnf   # or the docker0 IP 172.17.0.1
sudo systemctl restart mysql
mysql -uroot -p -e "CREATE USER IF NOT EXISTS 'abhig'@'172.%' IDENTIFIED BY '<password>';
  GRANT ALL ON StudentDB.* TO 'abhig'@'172.%'; GRANT ALL ON CourseDB.* TO 'abhig'@'172.%';
  GRANT ALL ON EnrollmentDB.* TO 'abhig'@'172.%'; GRANT ALL ON NotificationDB.* TO 'abhig'@'172.%';"
# firewall: allow 3306 from the docker bridge only. In .env: MYSQL_HOST=host.docker.internal MYSQL_PORT=3306
docker compose up -d --build
```
Restarting MySQL interrupts every other application using it – do it deliberately.

## Option B – TCP proxy sidecar (no MySQL change; the `mysql-proxy` compose profile)
`alpine/socat` runs with `network_mode: host`, listens on `${DOCKER_BRIDGE_IP}:3307` (default `172.17.0.1`, reachable from containers/host only, not from the LAN) and forwards to `127.0.0.1:3306`. Connections reach MySQL from 127.0.0.1, so the existing `abhig@localhost` grant works. In `.env`: `MYSQL_HOST=host.docker.internal`, `MYSQL_PORT=3307`.
```bash
docker compose --profile mysql-proxy up -d --build
```
This publishes the database to the docker bridge network; use it for local development only.
