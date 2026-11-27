# Port configuration

All ports live in the dedicated high range **18080-18110, 16379, 19092**. Before assigning them the machine was inspected:

* `ss -ltn` (listening sockets) - none of the ports below was listening; the busy ports at that time were 53, 631, 3000, 3306 (MySQL), 5858, 5959, 11434, 27017-27019, 30523, 33060 and a few ephemeral ports.
* `docker ps` published ports (3000, 5858, 5959, 27017-27019) - no overlap.
* All `*.yml / *.yaml / *.properties / *.env / *.json / *.xml / *.conf` files of the other local projects under `~/Documents/PROJECTS_TECKSTACK`, `~/eclipse-workspace`, `~/Documents/DEMO_PROJECTS` and `~/Documents/RCX_PROJS` were searched for each number - none of them is configured anywhere else.

The suggested allocation from the requirements was therefore free and is used unchanged. No two components of this project share a port.

| Component | Port | Application configuration location | Internal service URL | Verified available |
|---|---:|---|---|---|
| API Gateway | 18080 | `gateway/src/main/resources/application.yml` (`server.port`) | `http://localhost:18080` (the only URL for external clients) | Yes - free before start, verified listening afterwards |
| Patient Service | 18101 | `services/patient-service/src/main/resources/application.yml` | `http://localhost:18101` | Yes |
| Doctor Service | 18102 | `services/doctor-service/.../application.yml` | `http://localhost:18102` | Yes |
| Appointment Service | 18103 | `services/appointment-service/.../application.yml` | `http://localhost:18103` | Yes |
| Hospital Service (hospital master data + identity/JWT) | 18104 | `services/hospital-service/.../application.yml` | `http://localhost:18104` | Yes |
| Medical Records Service | 18105 | `services/medical-records-service/.../application.yml` | `http://localhost:18105` | Yes |
| Prescription Service | 18106 | `services/prescription-service/.../application.yml` | `http://localhost:18106` | Yes |
| Laboratory Service | 18107 | `services/laboratory-service/.../application.yml` | `http://localhost:18107` | Yes |
| Billing Service | 18108 | `services/billing-service/.../application.yml` | `http://localhost:18108` | Yes |
| Pharmacy Service | 18109 | `services/pharmacy-service/.../application.yml` | `http://localhost:18109` | Yes |
| Notification Service | 18110 | `services/notification-service/.../application.yml` | `http://localhost:18110` | Yes |
| Kafka (host listener) | 19092 | `docker/docker-compose.yml` (published `19092:9092`, advertised listener `localhost:19092`); clients: `hospital-common.yml` -> `spring.kafka.bootstrap-servers` / env `KAFKA_BOOTSTRAP_SERVERS` | `localhost:19092` | Yes |
| Redis | 16379 | `docker/docker-compose.yml` (published `16379:6379`); clients: `hospital-common.yml` -> `spring.data.redis.port` / env `REDIS_PORT` | `localhost:16379` | Yes |
| MySQL (existing server, **not changed**) | 3306 | env `MYSQL_HOST` / `MYSQL_PORT` (`.env`) | `localhost:3306` | Existing server, port untouched |

## Where the numbers are used consistently

| Consumer | Source of the value |
|---|---|
| Each service's own port | `server.port: ${SERVER_PORT:<port>}` in its `application.yml` |
| Service-to-service URLs (Feign / WebClient) | `hospital.services.<name>.url` in `common/src/main/resources/hospital-common.yml` (env overrides `PATIENT_SERVICE_URL`, `DOCTOR_SERVICE_URL`, ...) |
| API Gateway routes | `spring.cloud.gateway.routes[*].uri` in `gateway/src/main/resources/application.yml` (env overrides `*_SERVICE_URL`) |
| Kafka / Redis | `hospital-common.yml`, `.env`, `docker/docker-compose.yml` |
| Scripts | `scripts/common.sh` (service table), `scripts/e2e.py` (`GW = http://localhost:18080`) |

To move a component, change the port in its `application.yml` (or set `SERVER_PORT`), the matching `*_SERVICE_URL` default in `hospital-common.yml` and the gateway route, and `scripts/common.sh`.

## Re-verifying

```bash
ss -ltn | awk 'NR>1{print $4}' | sed 's/.*://' | sort -n | uniq | awk '$1>=16000 && $1<20000'   # what is listening in the range
```
