# SMS-Express — Student Management Service + Hookdeck Outpost

Express.js + MySQL student management API that publishes domain events
(student/course/enrollment lifecycle) to a dedicated [Hookdeck Outpost](https://github.com/hookdeck/outpost)
instance for outbound webhook delivery. Every one of Outpost's 30 REST
endpoints is reachable through `/api/outpost/*`.

## Isolation from other projects on this machine

This project provisions its **own** MySQL and Outpost stacks with distinct
container names, ports, and secrets so nothing here collides with:

- The existing `outpost-example-*` stack at `~/rcx/rcx-outpost/examples/docker-compose`
  (ports 3333/5433/5673/15673/6379).
- The system-installed MySQL service on port 3306.
- The unrelated `studentmgmt-mysql` container on port 3311.

| Component | Container | Host port |
|---|---|---|
| MySQL (`SMS-Express` db) | `sms-express-mysql` | `3320` (→ 3306) |
| Outpost API | `sms-outpost-api` | `3363` (→ 3333) |
| Outpost RabbitMQ mgmt UI | `sms-outpost-rabbitmq` | `15686` |
| Outpost Redis/Postgres | internal only | not published to host |

## Setup

```bash
cd docker/mysql && docker compose up -d && cd -
cd docker/outpost && docker compose up -d && cd -
npm install
npm start   # http://localhost:4000
```

`docker/mysql/init/01-schema.sql` auto-creates the `SMS-Express` database
and its `students`, `courses`, `enrollments` tables on first container start.

## Domain model

A student's `department` doubles as the Outpost **tenant_id** — each
department can attach its own webhook destination(s) and only receives
events for its own students/courses/enrollments.

Topics published: `student.created`, `student.updated`, `student.deleted`,
`student.enrolled`, `student.unenrolled`, `course.created`,
`course.updated`, `course.deleted`, `enrollment.created`,
`enrollment.updated`, `enrollment.cancelled`.

## API

### Domain endpoints (publish Outpost events as a side effect)

- `POST /api/students` `{firstName,lastName,email,department,enrollmentDate}`
- `GET /api/students?department=CS`
- `GET /api/students/:id`
- `PUT /api/students/:id`
- `DELETE /api/students/:id`
- `POST /api/courses` `{department,code,title,credits}`
- `GET /api/courses?department=CS`
- `GET|PUT|DELETE /api/courses/:id`
- `POST /api/enrollments` `{studentId,courseId}`
- `GET /api/enrollments?department=CS&studentId=1`
- `POST /api/enrollments/:id/cancel`

### Outpost passthrough (`/api/outpost/*`, mirrors Outpost's own API 1:1)

`GET /healthz`, `GET|PATCH /config`, `GET /tenants`,
`PUT|GET|DELETE /tenants/:tenantId`, `GET /tenants/:tenantId/portal`,
`GET /tenants/:tenantId/token`, full CRUD + enable/disable on
`/tenants/:tenantId/destinations[/:destinationId]`, `GET /events[/:id]`,
`GET /attempts[/:id]`, destination-scoped attempts, `POST /publish`,
`POST /retry`, `GET /destination-types[/:type]`, `GET /topics`,
`GET /metrics/events`, `GET /metrics/attempts`.

## Example flow

```bash
# Register a webhook destination for the CS department (tenant)
curl -s -X POST http://localhost:4000/api/outpost/tenants/CS/destinations \
  -H 'Content-Type: application/json' \
  -d '{"type":"webhook","topics":"*","config":{"url":"https://example.com/hooks"}}'

# Create a student -> publishes student.created to the CS tenant
curl -s -X POST http://localhost:4000/api/students \
  -H 'Content-Type: application/json' \
  -d '{"firstName":"Ada","lastName":"Lovelace","email":"ada@example.com","department":"CS","enrollmentDate":"2026-01-15"}'

# Check delivery attempts for that tenant/destination
curl -s http://localhost:4000/api/outpost/attempts
```
