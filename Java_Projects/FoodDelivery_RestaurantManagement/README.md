# Food Delivery & Restaurant Management: Spring Boot microservices

A complete, production-style **food delivery platform**: customers order from restaurants, owners run their kitchens, delivery
partners deliver, admins operate the platform. Java 21 · Spring Boot 3.4 · Spring Cloud 2024 · MySQL · Kafka · Redis · Log4j2 +
Elasticsearch/Logstash/Kibana · Angular 19.

```
Angular (4500) ──► API Gateway (9080) ──► 15 services (9101-9115)  ◄──► Eureka (9761)
                                              │   │   │
                         MySQL (1 DB / service) │   │   └── Redis (cache, token deny-list, rate limit)
                                                │   └────── Kafka (events, outbox, DLT) ──► event-audit-service (MySQL audit + monitoring API)
                                                └────────── Log4j2 JSON ─► Logstash ─► Elasticsearch ─► Kibana
```

## Quick start

```bash
cd ~/Documents/PROJECTS_TECKSTACK/Java_Projects/FoodDelivery_RestaurantManagement
# .env already holds the local secrets (git-ignored). MySQL = existing host server on :3306.
scripts/create-databases.sh          # 15 databases, one per service
scripts/build.sh                     # mvn clean install (all modules, incl. Flyway baselines)
scripts/start-all.sh                 # Docker infra + Eureka + 15 services + gateway (waits for each to be UP)
infrastructure/kibana/setup-kibana.sh   # imports the Kibana data view + operations dashboard
cd frontend && npm install && npm start # http://localhost:4500
python3 scripts/e2e.py               # live end-to-end verification through the gateway
scripts/stop-all.sh                  # stop the Java processes (add --infra to stop containers too)
```

Sign in as the bootstrap administrator `admin@fooddelivery.com` / the password in `.env` (`BOOTSTRAP_ADMIN_PASSWORD`),
or register a customer / restaurant owner / delivery partner on the login page.

URLs: App http://localhost:4500 · Swagger (all services) http://localhost:9080/swagger-ui.html · Eureka http://localhost:9761 ·
Kibana http://localhost:5601 (dashboard *Food Delivery - Operations*).

## Repository layout

| Path | Contents |
|---|---|
| `common/` | `food-common`: **technical** shared library only (JWT/security, outbox + idempotent consumers + DLT, Redis cache, Feign/WebClient config, Log4j2 config, file storage, AOP). No domain entities. |
| `service-discovery/`, `api-gateway/` | Eureka server; Spring Cloud Gateway (JWT validation, rate limiting, circuit breaker + fallback, CORS, correlation id) |
| `*-service/` (15) | the business microservices, each its own Spring Boot app, Maven module, port and database |
| `frontend/` | Angular 19 app (standalone components, signals, lazy routes, Material) |
| `infrastructure/` | `docker-compose.yml` (Kafka, Redis, Elasticsearch, Logstash, Kibana), Logstash pipeline, ES ILM policy/template, Kibana dashboard generator |
| `scripts/` | build / start / stop / schema-generation / `e2e.py` |
| `docs/` | the full guide (architecture, patterns, Kafka documentation, how to run) |

Further reading: `PORT-CONFIGURATION.md`, `docs/` (start with the single guide `*-food-delivery-microservices-complete-guide.md`).
