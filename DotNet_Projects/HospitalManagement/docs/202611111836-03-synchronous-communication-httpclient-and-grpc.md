# 3. Synchronous communication - HttpClient and gRPC

Synchronous calls are used only where the caller **needs the answer to continue** (validate a patient, read a slot grid, verify a prescription). Everything else is event driven (see the Kafka document). **Both** technologies are used in real business flows and both are wrapped by Polly.

## Call map

| Caller | Callee | Technique | Used for | Code |
|---|---|---|---|---|
| Appointment, Medical Records, Prescription, Laboratory, Billing | Patient | **gRPC** (`proto/patient.proto`, port 28201) | existence/status check, ownership (`UserId`) of patient data | `Shared/Http/PeerClients.cs` `PatientDirectory` |
| Pharmacy | Prescription | **gRPC** (`proto/prescription.proto`, port 28206) | prescription must be ACTIVE before dispensing | `PharmacyService/Clients/PrescriptionDirectory.cs` |
| Appointment, Prescription, Laboratory | Doctor | **HttpClient** (typed, `IHttpClientFactory`) | doctor profile/fee/active flag, live slot grid | `Shared/Http/PeerClients.cs` `DoctorClient` |
| Doctor | Hospital | **HttpClient** | validate hospital + department of a doctor | `DoctorService/Clients/HospitalClient.cs` |
| Billing | Appointment | **HttpClient** | verify the appointment of a manually raised APPOINTMENT bill | `BillingService/Clients/AppointmentClient.cs` |

Why this split: patient lookups are the hottest internal call (five callers, tiny fixed-shape payload) - a strongly typed HTTP/2 contract is ideal. The Doctor/Hospital/Appointment calls are ordinary resource reads that already exist as REST endpoints, so typed HttpClients reuse them. The caller's **JWT and correlation id are propagated on every call** (HttpClient `DownstreamHeadersHandler`, gRPC `GrpcHeadersInterceptor`), so the downstream service applies its own role checks - a service never gains privileges by calling another.

## HttpClient

```csharp
builder.Services.AddHospitalHttpClient<IDoctorDirectory, DoctorClient>("doctor-service", builder.Configuration["Services:Doctor"]);
```
* Registered through **`IHttpClientFactory`** (typed clients, no `new HttpClient()` anywhere); base address from `Services:*` configuration.
* **Polly pipeline** (`Microsoft.Extensions.Http.Resilience`, built on Polly v8) per client: total timeout 12 s -> **retry** (2x, exponential back-off + jitter, **GET/HEAD/OPTIONS only** - POST/PUT/PATCH/DELETE are never replayed) -> **circuit breaker** (50 % failures over 30 s, min 5 calls, 15 s open) -> per-attempt timeout 5 s.
* **Error handling** (`DownstreamResponse.ReadAsync`): 404 -> `NotFoundException`, other 4xx -> `DownstreamClientException` (status passed through, not counted as a dependency failure), 5xx / refused / timeout -> `ServiceUnavailableException`, open circuit -> `BrokenCircuitException` (handled to a clean 503).
* **Fallbacks** (in the client classes): doctor profile -> last-known copy (degraded, WARN log); slot grid and hospital validation -> **no fallback data, 503** - a booking must never be accepted against an unverified schedule, and a reference must not be stored unverified.

## gRPC

```proto
// proto/patient.proto
service PatientGrpc {
  rpc GetSummary (PatientIdRequest) returns (PatientSummaryReply);
  rpc GetByUser (UserIdRequest) returns (PatientSummaryReply);
}
```
* `.proto` files live in the solution's `proto/` folder and are compiled by `Grpc.Tools` in `Shared` (`GrpcServices="Both"`), giving strongly typed server base classes and clients (`PatientGrpc.PatientGrpcClient`, `PrescriptionGrpc.PrescriptionGrpcClient`) used by the services.
* **Server:** Patient/Prescription services host `PatientGrpcService` / `PrescriptionGrpcService` on a separate **HTTP/2 (h2c) Kestrel port** (28201 / 28206), `[Authorize]` with the same JWT validation as REST. `NotFound` is returned as `RpcException(StatusCode.NotFound)`.
* **Client:** `AddGrpcClient<T>` with `GrpcHeadersInterceptor`; **deadline 3 s per call**; calls run through the Polly **"grpc" pipeline** (`GrpcResilience`): retry 2x on `Unavailable/DeadlineExceeded/Internal` (all gRPC calls here are read-only lookups, hence safe) -> circuit breaker -> 8 s overall timeout. `NotFound`/`PermissionDenied` are business answers and never trip the breaker.
* **Fallbacks:** `PatientDirectory` serves the **last successfully fetched** summary when the Patient Service is down or its circuit is open; with nothing known -> 503. `PrescriptionDirectory` has no fallback (never dispense on an unverified prescription) -> 503.

## Verified behaviour (live test)
* **Doctor Service stopped** (HttpClient path): first availability request took ~0.4 s (the retries), the next ones failed instantly with 503 "circuit is open" (~4 ms) - no thread pile-up, no cascading failure.
* **Patient Service stopped** (gRPC path): requests for previously seen patients kept returning 200 from last-known data (WARN `serving last-known summary`), an unseen patient returned 503; after restart the breaker recovered on its own.

## Example: booking an appointment (synchronous part)
```
Client -> YARP -> Appointment Service
   1. PatientDirectory.RequireAccessAsync(patientId)  --gRPC-->      Patient Service    PatientGrpc.GetSummary
   2. DoctorClient.GetAsync(doctorId)                 --HttpClient-> Doctor Service     GET /api/doctors/{id}
   3. DoctorClient.SlotsAsync(doctorId, date)         --HttpClient-> Doctor Service     GET /api/doctors/{id}/slots?date=
   4. overlap checks + INSERT (unique slot key) + outbox row in ONE local transaction
   5. outbox relay publishes "AppointmentBooked" to Kafka after commit (asynchronous from here on)
```
