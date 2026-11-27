# 10. Port configuration and local startup

The authoritative port table - including **why the application ports are 30xxx rather than the suggested 38xxx** (the ephemeral-port clash) - is [`PORT-CONFIGURATION.md`](../PORT-CONFIGURATION.md). Summary:

| Component | Port | | Component | Port |
|---|---:|---|---|---:|
| API Gateway | 30080 | | Pharmacy Service | 30109 |
| Patient Service | 30101 (gRPC **30201**) | | Notification Service | 30110 |
| Doctor Service | 30102 (gRPC **30202**) | | Kafka | 39092 |
| Appointment Service | 30103 | | Redis | 36379 |
| Hospital Service | 30104 (gRPC **30204**) | | MySQL (existing, unchanged) | 3306 |
| Medical Records 30105, Prescription 30106 | | | Laboratory 30107, Billing 30108 | |

## Prerequisites
Node.js ≥ 20.11 (installed: 20.11.1), npm, Docker (Kafka + Redis), the existing local MySQL, `mysql` client and `python3` (only for the SQL script / e2e).

## One-time set-up
```bash
cd ~/Documents/PROJECTS_TECKSTACK/NodeJS_Projects/HospitalManagement
cp .env.example .env && chmod 600 .env && $EDITOR .env      # MYSQL_PASSWORD (already present on this machine)
npm install                                                  # workspaces: installs everything once
npm run prisma:generate   # or: for each service  npx prisma generate --schema prisma/schema.prisma
docker compose up -d                                         # Kafka :39092, Redis :36379
./scripts/create-databases.sh                                # 10 databases + Prisma init migrations (idempotent, baseline-safe)
```
`prisma generate` writes each service's own client into `services/<name>/generated/client` (git-ignored) - run it again after changing a schema.

## Run everything
```bash
./scripts/start-all.sh      # 10 services + gateway as detached node processes; waits for each /ping
python3 scripts/e2e.py      # optional: 146 checks through the gateway
./scripts/stop-all.sh       # SIGTERM to the processes listening on the project ports -> graceful shutdown
docker compose down         # infrastructure (add -v to drop Kafka/Redis data)
```
Logs: `logs/<service>.out` (stdout) and Pino rolling files `logs/<service>.<n>.log`.

## Start each microservice individually
Every service is independently executable (`npm start` inside its folder, or `node src/index.js`). Load the environment first (`set -a; . ./.env; set +a`) - the services also read `.env` themselves through `dotenv`.

| Service | Command | REST (gRPC) |
|---|---|---|
| Hospital (start first - identity) | `cd services/hospital-service && npm start` | 30104 (30204) |
| Patient | `cd services/patient-service && npm start` | 30101 (30201) |
| Doctor | `cd services/doctor-service && npm start` | 30102 (30202) |
| Appointment | `cd services/appointment-service && npm start` | 30103 |
| Medical Records | `cd services/medical-records-service && npm start` | 30105 |
| Prescription | `cd services/prescription-service && npm start` | 30106 |
| Laboratory | `cd services/laboratory-service && npm start` | 30107 |
| Billing | `cd services/billing-service && npm start` | 30108 |
| Pharmacy | `cd services/pharmacy-service && npm start` | 30109 |
| Notification | `cd services/notification-service && npm start` | 30110 |
| API Gateway | `cd api-gateway && npm start` | 30080 |

Start order is not enforced: services retry Kafka/Redis in the background and a service whose peers are down answers 503 (Opossum) instead of failing. A service refuses to start only if MySQL is unreachable (logged at `fatal`).

## Configuration (environment variables, all optional except the MySQL password)
`PORT`, `GRPC_PORT`, `LOG_LEVEL`, `LOG_DIR`, `KAFKA_BROKERS`, `REDIS_URL`, `<NAME>_SERVICE_URL` / `<NAME>_GRPC_ADDRESS`, `JWT_SECRET`, `JWT_ACCESS_TTL`, `JWT_REFRESH_TTL_DAYS`, `HTTP_TIMEOUT_MS`, cache TTLs (`CACHE_*_SEC`), job schedules (`REMINDER_CRON`, `REMINDER_LEAD_HOURS`, `PENDING_PAYMENTS_CRON`, `PAYMENT_TIMEOUT_MINUTES`, `OVERDUE_CRON`, `BILL_REMINDER_HOURS`, `LOW_STOCK_CRON`, `PRESCRIPTION_EXPIRY_CRON`, `DELIVERY_CRON`, `JOBS_DISABLED`), gateway (`GATEWAY_TIMEOUT_MS`, `RATE_LIMIT_PER_MIN`, `AUTH_RATE_LIMIT_PER_MIN`, `CORS_ORIGINS`), `UPLOAD_DIR`, `SEED_*_PASSWORD`. Example: `REMINDER_LEAD_HOURS=48 REMINDER_CRON='*/30 * * * * *' ./scripts/start-all.sh`.
