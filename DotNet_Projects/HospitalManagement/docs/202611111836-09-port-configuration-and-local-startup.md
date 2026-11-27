# 9. Port configuration and local application startup

The authoritative port table (with how each port was verified) is [`PORT-CONFIGURATION.md`](../PORT-CONFIGURATION.md). Summary:

| Component | Port | | Component | Port |
|---|---:|---|---|---:|
| API Gateway (YARP) | 28080 | | Pharmacy Service | 28109 |
| Patient Service | 28101 (gRPC **28201**) | | Notification Service | 28110 |
| Doctor Service | 28102 | | Prescription gRPC | **28206** |
| Appointment Service | 28103 | | Kafka | 29092 |
| Hospital Service | 28104 | | Redis | 26379 |
| Medical Records Service | 28105 | | MySQL (existing, unchanged) | 3306 |
| Prescription Service | 28106 | | Laboratory 28107, Billing 28108 | |

## Prerequisites
.NET 8 SDK (the installed one is 8.0.422 at `~/.dotnet`; the scripts put it on `PATH`), Docker (Kafka + Redis), the existing local MySQL, `python3` (only for `scripts/e2e.py`), `mysql` client (for the SQL scripts).

## One-time set-up
```bash
cd ~/Documents/PROJECTS_TECKSTACK/DotNet_Projects/HospitalManagement
cp .env.example .env && chmod 600 .env && $EDITOR .env      # set MYSQL_PASSWORD (Jwt__Key optional)
docker compose up -d                                         # Kafka :29092, Redis :26379
./scripts/create-databases.sh                                # CREATE DATABASE IF NOT EXISTS x10 + idempotent EF migration scripts
```
(The services also run their own migrations at start-up, so `create-databases.sh` is optional but recommended - it creates the databases, which EF cannot do without privileges you may prefer to keep separate.)

## Build and run everything
```bash
./scripts/build.sh          # dotnet publish (Release) of all 11 projects into .publish/
./scripts/start-all.sh      # starts the 10 services + gateway (logs/<name>.out), waits until each answers
python3 scripts/e2e.py      # optional: 142 end-to-end checks through the gateway
./scripts/verify-db.sh      # read-only: connectivity + hdn_ tables per service
./scripts/stop-all.sh       # stops the processes listening on the project ports
docker compose down         # infrastructure (add -v to drop Kafka/Redis data)
```
`start-all.sh` skips a port that is already in use, so single services can be restarted: `kill <pid from ss -ltnp "sport = :28103">` then `./scripts/start-all.sh`.

## Starting each microservice individually
Every service is independently executable. Set the environment once (`set -a; . ./.env; set +a`) and run any of:

| Service | Command (from the repository root) | REST port |
|---|---|---:|
| Hospital (start first - identity) | `dotnet run --project src/HospitalService --no-launch-profile` | 28104 |
| Patient | `dotnet run --project src/PatientService --no-launch-profile` | 28101 / gRPC 28201 |
| Doctor | `dotnet run --project src/DoctorService --no-launch-profile` | 28102 |
| Appointment | `dotnet run --project src/AppointmentService --no-launch-profile` | 28103 |
| Medical Records | `dotnet run --project src/MedicalRecordsService --no-launch-profile` | 28105 |
| Prescription | `dotnet run --project src/PrescriptionService --no-launch-profile` | 28106 / gRPC 28206 |
| Laboratory | `dotnet run --project src/LaboratoryService --no-launch-profile` | 28107 |
| Billing | `dotnet run --project src/BillingService --no-launch-profile` | 28108 |
| Pharmacy | `dotnet run --project src/PharmacyService --no-launch-profile` | 28109 |
| Notification | `dotnet run --project src/NotificationService --no-launch-profile` | 28110 |
| API Gateway | `dotnet run --project src/ApiGateway --no-launch-profile` | 28080 |

Start order is not enforced: services retry MySQL/Kafka connections, and a service whose peers are down answers 503 (protected by Polly) instead of failing. Configuration comes from `appsettings.json` and can be overridden by environment variables using the double-underscore form, e.g. `Ports__Http=28181`, `Kafka__BootstrapServers=host:9092`, `Redis__ConnectionString=host:6379`, `Services__Doctor=http://host:28102`, `Scheduler__ReminderLeadHours=48`, `Billing__ReminderIntervalHours=12`.

## Logs
Console and rolling files `logs/<service>-<yyyyMMdd>.log` (Serilog, 7 days / 20 MB). Format: `time level [service] [correlationId] source - message`.
