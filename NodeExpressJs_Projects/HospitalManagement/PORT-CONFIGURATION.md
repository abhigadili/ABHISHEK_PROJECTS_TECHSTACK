# Port configuration

Gateway / REST **30080, 30101-30110**, gRPC **30201, 30202, 30204**, Kafka **39092**, Redis **36379**. Before assigning ports the machine was inspected:

* `ss -ltn` (listening sockets): none of the ports below was listening (busy then: 53, 631, 3000, 3306 MySQL, 5858, 5959, 11434, 27017-27019, 30523, 33060 and the Java build's 18xxx/16379/19092 and the .NET build's 28xxx/26379/29092).
* `docker ps` published ports - no overlap.
* All `*.yml / *.yaml / *.properties / *.env / *.json / *.xml / *.conf / *.js / *.cs` files of the other local projects (`~/Documents/PROJECTS_TECKSTACK`, `~/eclipse-workspace`, `~/Documents/DEMO_PROJECTS`, `~/Documents/RCX_PROJS`) were searched for each number. Nothing configures any of them; the only textual hit (`30110`) is a version string inside Eclipse's Gradle metadata (`versions.json`), not a port.

## Deviation from the suggested 38xxx range - and why
The suggested ports 38080 / 381xx were **free**, but they lie inside the Linux *ephemeral* port range (`/proc/sys/net/ipv4/ip_local_port_range` = 32768-60999). Any outgoing connection (Kafka clients of the other two builds, for example) can be handed such a port at random, and that is exactly what happened: starting the Hospital Service's gRPC listener on 38204 failed with `EADDRINUSE` because another process held 38204 as the *source port* of its Kafka connection (visible with `ss -tanp`). A port in that range can therefore never be reserved reliably without root (`ip_local_reserved_ports`). The application ports were consequently moved to the **30xxx block below 32768**, which the kernel never hands out; the numbering scheme (…80 gateway, …101-110 services, …201/202/204 gRPC) is unchanged. Kafka (39092) and Redis (36379) keep the suggested numbers because Docker binds them once at container start and holds them permanently.

| Component | Port | Protocol | Configuration location | Internal service URL | Verified available |
|---|---:|---|---|---|---|
| API Gateway (Express + http-proxy-middleware) | 30080 | HTTP | `shared/constants/index.js` `DEFAULT_PORTS.gateway` (env `PORT`) | `http://localhost:30080` (only URL for external clients) | Yes - free before start, listening afterwards |
| Patient Service | 30101 | HTTP | `DEFAULT_PORTS.patient` / env `PORT` | `http://localhost:30101` | Yes |
| Patient Service - **gRPC** | **30201** | gRPC (HTTP/2) | `DEFAULT_PORTS.grpc.patient` / env `GRPC_PORT` | `localhost:30201` | Yes |
| Doctor Service | 30102 | HTTP | `DEFAULT_PORTS.doctor` | `http://localhost:30102` | Yes |
| Doctor Service - **gRPC** | **30202** | gRPC | `DEFAULT_PORTS.grpc.doctor` | `localhost:30202` | Yes |
| Appointment Service | 30103 | HTTP | `DEFAULT_PORTS.appointment` | `http://localhost:30103` | Yes |
| Hospital Service (hospital data + identity/JWT) | 30104 | HTTP | `DEFAULT_PORTS.hospital` | `http://localhost:30104` | Yes |
| Hospital Service - **gRPC** | **30204** | gRPC | `DEFAULT_PORTS.grpc.hospital` | `localhost:30204` | Yes |
| Medical Records Service | 30105 | HTTP | `DEFAULT_PORTS['medical-records']` | `http://localhost:30105` | Yes |
| Prescription Service | 30106 | HTTP | `DEFAULT_PORTS.prescription` | `http://localhost:30106` | Yes |
| Laboratory Service | 30107 | HTTP | `DEFAULT_PORTS.laboratory` | `http://localhost:30107` | Yes |
| Billing Service | 30108 | HTTP | `DEFAULT_PORTS.billing` | `http://localhost:30108` | Yes |
| Pharmacy Service | 30109 | HTTP | `DEFAULT_PORTS.pharmacy` | `http://localhost:30109` | Yes |
| Notification Service | 30110 | HTTP | `DEFAULT_PORTS.notification` | `http://localhost:30110` | Yes |
| Kafka (host listener) | 39092 | Kafka | `docker-compose.yml` (`39092:9092`, advertised `localhost:39092`); clients: env `KAFKA_BROKERS` (`.env`) | `localhost:39092` | Yes |
| Redis | 36379 | RESP | `docker-compose.yml` (`36379:6379`); clients: env `REDIS_URL` | `redis://localhost:36379` | Yes |
| MySQL (existing server, **not changed**) | 3306 | MySQL | `.env` `MYSQL_HOST` / `MYSQL_PORT` | `localhost:3306` | Existing server, port untouched |

gRPC runs on its own port next to the REST port of the same service (Express and grpc-js are separate servers). Only the REST ports are routed by the gateway; gRPC ports are internal and every call needs a JWT.

## Where the numbers are used (all from one place)
| Consumer | Source |
|---|---|
| Each service's REST / gRPC listen port | `loadConfig()` in `shared/config/index.js` → `DEFAULT_PORTS` (overridable by `PORT` / `GRPC_PORT`) |
| HTTP clients (fetch + Opossum) | `config.services.http.<name>` ← `<NAME>_SERVICE_URL` |
| gRPC clients | `config.services.grpc.<name>` ← `<NAME>_GRPC_ADDRESS` |
| Gateway routes | `api-gateway/config/routes.json` (service name) → `config.services.http` |
| Kafka / Redis | `.env` (`KAFKA_BROKERS`, `REDIS_URL`), `docker-compose.yml` |
| Scripts | `scripts/common.sh` (service table), `scripts/e2e.py` (`GW = http://localhost:30080`) |

```bash
ss -ltn | awk 'NR>1{print $4}' | sed 's/.*://' | sort -n | uniq | awk '$1>=30000 && $1<40000'   # what listens in the range
```
