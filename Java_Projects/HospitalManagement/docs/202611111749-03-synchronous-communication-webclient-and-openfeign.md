# 3. Synchronous communication - WebClient and OpenFeign

Synchronous calls are used only where the caller **needs the answer to continue** (validate a patient, read a slot grid, verify a prescription). Everything else is event driven (see the Kafka document). Both techniques are used in real flows and both are wrapped by Resilience4j circuit breakers.

## Call map

| Caller | Callee | Technique | Used for | Class |
|---|---|---|---|---|
| Appointment, Medical Records, Prescription, Laboratory, Billing | Patient | **OpenFeign** | existence/status check, ownership (`userId`) of patient data | `common/.../client/PatientClient` + `PatientGateway` |
| Doctor | Hospital | **OpenFeign** | validate hospital + department of a doctor | `doctor/.../client/HospitalClient` + `HospitalGateway` |
| Pharmacy | Prescription | **OpenFeign** | prescription must be ACTIVE before dispensing | `pharmacy/.../client/PrescriptionClient` + `PrescriptionGateway` |
| Appointment, Prescription, Laboratory | Doctor | **WebClient** | doctor profile/fee/active flag, live slot grid | `common/.../client/DoctorGateway` |
| Billing | Appointment | **WebClient** | verify a manual APPOINTMENT bill refers to the patient's real appointment | `billing/.../client/AppointmentGateway` |

The JWT of the original caller is **propagated** on every call (Feign `RequestInterceptor`, WebClient `ExchangeFilterFunction` in `common`), so the downstream service applies its own role checks - a service never gains privileges by calling another.

## OpenFeign

```java
@FeignClient(name = "patient-service", url = "${hospital.services.patient.url}")
public interface PatientClient {
    @GetMapping("/api/patients/{id}/summary")  PatientSummary summary(@PathVariable("id") Long id);
    @GetMapping("/api/patients/by-user/{userId}") PatientSummary byUser(@PathVariable("userId") Long userId);
}
```
* Clients are enabled per service with `@EnableFeignClients(clients = PatientClient.class)`; URLs come from `hospital-common.yml` (env-overridable).
* Timeouts: `spring.cloud.openfeign.client.config.default` -> connect 2 s, read 5 s.
* **Error handling:** one `ErrorDecoder` (`FeignCommonConfig`) maps HTTP answers to typed exceptions through `HttpErrors.map`: 404 -> `ResourceNotFoundException`, other 4xx -> `DownstreamClientException` (status passed through), 5xx -> `ServiceUnavailableException`. Connection refused / timeouts are normalised to `ServiceUnavailableException` by `Downstream.call`.

## WebClient

```java
this.client = factory.create("doctor-service", baseUrl);        // WebClientFactory: reusable, configured instance
public List<SlotView> slots(Long doctorId, LocalDate date) {
    return Downstream.call("doctor-service", () -> client.get()
        .uri(u -> u.path("/api/doctors/{id}/slots").queryParam("date", date).build(doctorId))
        .retrieve().bodyToMono(new ParameterizedTypeReference<List<SlotView>>() {}).block(factory.blockTimeout()));
}
```
* `WebClientFactory` builds each client once (Reactor Netty): connect timeout 2 s, response timeout 5 s (`hospital.webclient.*`), JWT-propagation filter, and an error-mapping filter that converts non-2xx answers with the same `HttpErrors` mapping as Feign.
* The services are servlet (MVC) applications, so the non-blocking client is `block()`ed with a timeout at the edge of the call - still non-blocking on the wire, and it keeps transactions simple.

## Circuit breakers (Resilience4j)

Each gateway class has `@CircuitBreaker(name=..., fallbackMethod=...)`:

| Instance | Wraps | Fallback behaviour |
|---|---|---|
| `patientService` | Feign Patient calls | serve the **last successfully fetched** summary (degraded, logged as WARN); with nothing known -> 503 |
| `doctorService` | WebClient Doctor calls | doctor profile: last-known (degraded); slot grid: 503 "schedule temporarily unavailable" (a booking must never be accepted against an unverified schedule) |
| `hospitalService` | Feign Hospital calls | 503 (a reference must not be stored unverified) |
| `prescriptionService` | Feign Prescription calls | 503 (never dispense on an unverified prescription) |
| `appointmentService` | WebClient Appointment calls | 503 |

Thresholds are in [Redis & Resilience4j](./202611111749-07-redis-caching-and-resilience4j.md). Business answers (404/400/409) are **ignored** by the breaker; only unavailability, timeouts and 5xx count as failures.

### Verified behaviour (live test)
* Doctor Service stopped, 8 booking-availability calls: calls 1-5 -> 503 "Doctor schedule is temporarily unavailable" after a real connection failure, call 6+ -> **instant** 503 "circuit is open" (~9 ms instead of connect timeouts) - no thread pile-up, no cascading failure.
* Patient Service stopped: previously seen patients keep being served from last-known data (HTTP 200, WARN log "serving last-known summary"); an unseen patient -> 503. After restart the breaker half-opens after 15 s and the calls recover.

## Example flow: booking an appointment (synchronous part)
```
Client -> Gateway -> Appointment Service
   1. PatientGateway.requireAccess(patientId)   --Feign-->   Patient Service  GET /api/patients/{id}/summary
   2. DoctorGateway.doctor(doctorId)            --WebClient-> Doctor Service   GET /api/doctors/{id}
   3. DoctorGateway.slots(doctorId, date)       --WebClient-> Doctor Service   GET /api/doctors/{id}/slots?date=
   4. overlap checks + INSERT in AppointmentDB (one local transaction)
   5. outbox row "AppointmentBooked" saved in the same transaction -> Kafka (asynchronous from here on)
```
