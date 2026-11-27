# 3. Synchronous communication - HTTP and gRPC

Synchronous calls are used only where the caller **needs the answer to continue** (validate a patient, read a slot grid, verify a prescription). Everything else is event driven (Kafka document). **Both** technologies are used in real flows, both protected by Opossum circuit breakers.

## Call map

| Caller | Callee | Technique | Used for | Code |
|---|---|---|---|---|
| Appointment, Medical Records, Prescription, Laboratory, Billing | Patient | **gRPC** (`proto/patient.proto`, :30201) | existence/status, ownership (`userId`) of patient data | `shared/clients` `createPatientDirectory` |
| Appointment, Prescription, Laboratory | Doctor | **gRPC** (`proto/doctor.proto`, :30202) | doctor profile, fee, active flag | `shared/clients` `createDoctorDirectory.get` |
| Doctor | Hospital | **gRPC** (`proto/hospital.proto`, :30204) | validate hospital + department of a doctor | `doctor-service/src/service.js` `createHospitalDirectory` |
| Appointment | Doctor | **HTTP** (`fetch` + Opossum) `GET /api/doctors/:id/slots` | live slot grid at booking time | `createDoctorDirectory.slots` |
| Billing | Appointment | **HTTP** `GET /api/appointments/:id` | verify the appointment of a manual bill | `billing-service/src/index.js` |
| Pharmacy | Prescription | **HTTP** `GET /api/prescriptions/:id/status` | prescription must be ACTIVE before dispensing | `pharmacy-service/src/index.js` |

Split rationale: the Patient/Doctor/Hospital lookups are hot, fixed-shape internal calls - a typed HTTP/2 contract fits; the slot grid, appointment and prescription status already exist as REST resources, so the reusable HTTP client reuses them. The caller's **JWT and correlation id travel on every call** (HTTP headers / gRPC metadata, taken from the request's `AsyncLocalStorage` context), so the downstream service applies its own role checks - a service never gains privileges by calling another.

## HTTP client (`shared/utils/http-client.js`) - one reusable module, no duplicated configuration
```js
const http = createHttpClient({ name: 'prescription-service', baseUrl: config.services.http.prescription, logger, timeoutMs: config.http.timeoutMs });
await http.get(`/api/prescriptions/${id}/status`);
```
* native `fetch`, `AbortSignal.timeout` (default 4 s), base URL from configuration (`PRESCRIPTION_SERVICE_URL` overrides);
* **Opossum** breaker per client (settings in the Redis & Opossum document); **4xx answers are business answers** and are excluded from the failure count (`errorFilter`);
* **retries only for GET** (2 retries, exponential back-off + jitter) - POST/PUT are never replayed automatically;
* error mapping: 404 → `NotFoundError`, other 4xx → `DownstreamClientError` (status passed through), timeouts / refused / 5xx / open circuit → `ServiceUnavailableError` (503);
* optional **last-known fallback** for GETs (`lastKnownFallback`). Used where stale data is harmless; the slot grid and the prescription status deliberately have none.

## gRPC (`shared/grpc/index.js`, `proto/*.proto`)
```proto
service PatientService { rpc GetSummary (PatientIdRequest) returns (PatientSummary); rpc GetByUser (UserIdRequest) returns (PatientSummary); }
```
* `@grpc/proto-loader` loads the contracts from `proto/` (`loadProto('patient.proto')`).
* **Server** `startGrpcServer`: runs next to the Express port (`GRPC_PORT`); **every call needs a valid JWT** in the `authorization` metadata (same `jose` verification as HTTP; optional role list per service); the call runs in the caller's correlation context; `AppError`s map to gRPC codes (NotFound → `NOT_FOUND`, Forbidden → `PERMISSION_DENIED`, Unauthorized → `UNAUTHENTICATED`, BadRequest → `INVALID_ARGUMENT`, other → `INTERNAL`).
* **Client** `createGrpcClient`: promise-based methods, **per-call deadline (3 s)**, JWT + correlation metadata, Opossum breaker per method; `NOT_FOUND/PERMISSION_DENIED/INVALID_ARGUMENT/UNAUTHENTICATED` are business answers and do not trip it; `UNAVAILABLE/DEADLINE_EXCEEDED` become `ServiceUnavailableError`.
* **Fallbacks:** the patient and doctor directories serve the **last successfully fetched** value (degraded, WARN log) when the service is down / its circuit is open; with nothing known → 503. Hospital validation has no fallback (a reference is never stored unverified).

## Verified behaviour (live)
* **Doctor Service stopped** (HTTP path): first availability request ~0.57 s (retries), the next ones **3 ms** with 503 "circuit is open"; no thread pile-up.
* **Patient Service stopped** (gRPC path): requests for previously seen patients kept returning 200 from last-known data; an unseen patient → 503 "no previously validated data"; after restart the breaker half-opened and recovered (log lines `Circuit breaker OPEN / HALF-OPEN / CLOSED` for every state change).

## Example: booking an appointment (synchronous part)
```
Client → Gateway → Appointment Service
  1. patients.requireAccess(patientId, user)  ──gRPC──►  Patient Service   PatientService.GetSummary
  2. doctors.get(doctorId)                    ──gRPC──►  Doctor Service    DoctorService.GetDoctor
  3. doctors.slots(doctorId, date)            ──HTTP──►  Doctor Service    GET /api/doctors/:id/slots?date=
  4. overlap checks + prisma.$transaction{ INSERT appointment (unique slotKey) + outbox row }
  5. the outbox relay publishes "AppointmentBooked" to Kafka after commit (asynchronous from here on)
```
