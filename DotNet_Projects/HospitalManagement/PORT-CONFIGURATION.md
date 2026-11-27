# Port configuration

All ports are in the dedicated high range **26379-29092** (gateway/REST 28080-28110, gRPC 282xx, Redis 26379, Kafka 29092). Before assigning them the machine was inspected:

* `ss -ltn` (listening sockets) - none of the ports below was listening (busy at that time: 53, 631, 3000, 3306 MySQL, 5858, 5959, 11434, 27017-27019, 30523, 33060, 18080-18110 / 16379 / 19092 of the separate Java version of this system).
* `docker ps` published ports (3000, 5858, 5959, 27017-27019 and the Java system's 16379 / 19092) - no overlap.
* All `*.yml / *.yaml / *.properties / *.env / *.json / *.xml / *.conf / *.cs` files of the other local projects under `~/Documents/PROJECTS_TECKSTACK`, `~/eclipse-workspace`, `~/Documents/DEMO_PROJECTS` and `~/Documents/RCX_PROJS` were searched for each number - none is configured anywhere else.

The suggested allocation from the requirements was free and is used unchanged, plus two extra ports for the gRPC (HTTP/2) listeners. No two components share a port.

| Component | Port | Protocol | Configuration location | Internal service URL | Verified available |
|---|---:|---|---|---|---|
| API Gateway (YARP) | 28080 | HTTP/1.1 | `src/ApiGateway/appsettings.json` -> `Ports:Http` | `http://localhost:28080` (the only URL for external clients) | Yes - free before start, listening afterwards |
| Patient Service | 28101 | HTTP/1.1 (REST) | `src/PatientService/appsettings.json` -> `Ports:Http` | `http://localhost:28101` | Yes |
| Patient Service - **gRPC** | **28201** | HTTP/2 (cleartext, h2c) | `src/PatientService/appsettings.json` -> `Ports:Grpc` | `http://localhost:28201` | Yes |
| Doctor Service | 28102 | HTTP/1.1 | `src/DoctorService/appsettings.json` | `http://localhost:28102` | Yes |
| Appointment Service | 28103 | HTTP/1.1 | `src/AppointmentService/appsettings.json` | `http://localhost:28103` | Yes |
| Hospital Service (hospital data + identity/JWT) | 28104 | HTTP/1.1 | `src/HospitalService/appsettings.json` | `http://localhost:28104` | Yes |
| Medical Records Service | 28105 | HTTP/1.1 | `src/MedicalRecordsService/appsettings.json` | `http://localhost:28105` | Yes |
| Prescription Service | 28106 | HTTP/1.1 (REST) | `src/PrescriptionService/appsettings.json` -> `Ports:Http` | `http://localhost:28106` | Yes |
| Prescription Service - **gRPC** | **28206** | HTTP/2 (h2c) | `src/PrescriptionService/appsettings.json` -> `Ports:Grpc` | `http://localhost:28206` | Yes |
| Laboratory Service | 28107 | HTTP/1.1 | `src/LaboratoryService/appsettings.json` | `http://localhost:28107` | Yes |
| Billing Service | 28108 | HTTP/1.1 | `src/BillingService/appsettings.json` | `http://localhost:28108` | Yes |
| Pharmacy Service | 28109 | HTTP/1.1 | `src/PharmacyService/appsettings.json` | `http://localhost:28109` | Yes |
| Notification Service | 28110 | HTTP/1.1 | `src/NotificationService/appsettings.json` | `http://localhost:28110` | Yes |
| Kafka (host listener) | 29092 | Kafka | `docker-compose.yml` (`29092:9092`, advertised `localhost:29092`); clients: `Kafka:BootstrapServers` in every `appsettings.json` / env `Kafka__BootstrapServers` | `localhost:29092` | Yes |
| Redis | 26379 | RESP | `docker-compose.yml` (`26379:6379`); clients: `Redis:ConnectionString` / env `Redis__ConnectionString` | `localhost:26379` | Yes |
| MySQL (existing server, **not changed**) | 3306 | MySQL | env `MYSQL_HOST` / `MYSQL_PORT` in `.env` | `localhost:3306` | Existing server, port untouched |

## Why two ports for Patient and Prescription
Kestrel without TLS cannot negotiate HTTP/2 on a port that also serves HTTP/1.1, so a service that hosts gRPC listens twice (`Shared/Hosting/HospitalHosting.ConfigureHospitalKestrel`): REST on `Ports:Http` (HTTP/1.1) and gRPC on `Ports:Grpc` (HTTP/2 only). Only the REST ports are routed by the gateway; the gRPC ports are internal and require a JWT.

## Where the numbers are used consistently
| Consumer | Source |
|---|---|
| Each service's REST / gRPC listen port | `Ports:Http` / `Ports:Grpc` in its `appsettings.json` (code default identical, overridable with env `Ports__Http`) |
| HttpClient base addresses | `Services:Doctor`, `Services:Hospital`, `Services:Appointment` |
| gRPC client addresses | `Services:PatientGrpc` (28201), `Services:PrescriptionGrpc` (28206) |
| YARP destinations | `ReverseProxy:Clusters:*:Destinations` in `src/ApiGateway/appsettings.json` |
| Kafka / Redis | `appsettings.json`, `.env`, `docker-compose.yml` |
| Scripts | `scripts/common.sh` (service table), `scripts/e2e.py` (`GW = http://localhost:28080`) |

## Re-verifying
```bash
ss -ltn | awk 'NR>1{print $4}' | sed 's/.*://' | sort -n | uniq | awk '$1>=26000 && $1<30000'   # what is listening in the range
```
