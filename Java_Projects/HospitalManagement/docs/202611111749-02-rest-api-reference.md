# 2. REST API reference

All external calls go through the **gateway** `http://localhost:18080`. Send `Authorization: Bearer <JWT>` on everything except `/api/auth/login` and `/api/auth/register`. Dates are ISO (`2026-11-16`), times `HH:mm[:ss]`, timestamps ISO-8601 UTC. Pagination: `?page=0&size=20`, responses are `{content, page, size, totalElements, totalPages}`.

Role keys: **A** = ADMIN, **D** = DOCTOR, **P** = PATIENT, **L** = LAB_STAFF, **PH** = PHARMACIST, **B** = BILLING_STAFF. "P(own)" means a patient may only touch data that belongs to them (otherwise 403).

Error body (all services, same shape): `{"timestamp","status","error","message","path","details":[...]}`. Typical statuses: 400 validation, 401 missing/invalid token, 403 role/ownership, 404 not found, 409 conflict/duplicate/invalid state, 503 dependency unavailable.

## Authentication & users (Hospital Service)

| Method & path | Roles | Purpose |
|---|---|---|
| `POST /api/auth/login` | public | Returns a JWT |
| `POST /api/auth/register` | public | Self-service PATIENT account |
| `GET /api/auth/me` | any | Current account |
| `POST /api/users` | A | Create an account with any role |
| `GET /api/users` | A | List accounts |
| `PATCH /api/users/{id}/enabled` | A | Enable/disable an account |

```http
POST /api/auth/login
{ "username": "admin", "password": "Admin@123" }
```
```json
200 { "accessToken": "eyJhbGciOiJIUzI1NiJ9...", "tokenType": "Bearer", "expiresInSeconds": 7200,
      "user": { "id": 1, "username": "admin", "email": "admin@hospital.local", "role": "ADMIN", "enabled": true } }
401 { "status": 401, "error": "Unauthorized", "message": "Invalid username or password", ... }
```
```http
POST /api/auth/register            { "username": "asha.rao", "email": "asha@mail.com", "password": "Patient@123" }   -> 201 { "id": 9, "username": "asha.rao", "role": "PATIENT", ... }
POST /api/users  (A)               { "username": "dr.kumar", "email": "kumar@hospital.local", "password": "Doctor@1234", "role": "DOCTOR" }
```

## Hospitals & departments (Hospital Service)

| Method & path | Roles | Notes |
|---|---|---|
| `POST /api/hospitals` | A | 409 on duplicate `code` |
| `GET /api/hospitals`, `GET /api/hospitals/{id}` | any | `{id}` is Redis-cached |
| `PUT /api/hospitals/{id}` | A | Updates cache entry |
| `DELETE /api/hospitals/{id}` | A | Deactivate (204), evicts cache |
| `GET /api/hospitals/{id}/departments` | any | cached |
| `POST /api/hospitals/{id}/departments` | A | 409 on duplicate name within the hospital |
| `GET/PUT/DELETE /api/departments/{id}` | any / A / A | |

```json
POST /api/hospitals { "name": "City General Hospital", "code": "CGH", "city": "Hyderabad", "address": "1 Health Avenue", "phone": "+91-40-5550100", "email": "info@cgh.local" }
201 { "id": 1, "name": "City General Hospital", "code": "CGH", "city": "Hyderabad", "active": true, ... }
```

## Patients (Patient Service)

| Method & path | Roles | Notes |
|---|---|---|
| `POST /api/patients` | A, P | PATIENT: profile is bound to the caller (one per login) |
| `GET /api/patients?q=&page=&size=` | A, D, L, PH, B | name/e-mail/phone search |
| `GET /api/patients/{id}` | A, D, L, PH, B, P(own) | cached |
| `GET /api/patients/{id}/summary` | any | minimal projection used by Feign clients |
| `GET /api/patients/by-user/{userId}` | any | summary by login id |
| `GET /api/patients/by-user/{userId}/profile` | A, staff, P(own) | full profile by login id |
| `PUT /api/patients/{id}` | A, P(own) | |
| `DELETE /api/patients/{id}` | A | deactivate |

```json
POST /api/patients
{ "firstName": "Asha", "lastName": "Rao", "dateOfBirth": "1990-05-17", "gender": "FEMALE", "email": "asha@mail.com",
  "phone": "+919876543210", "identityNumber": "AADHAAR-1234", "bloodGroup": "O+", "address": "12 Lake Road",
  "emergencyContactName": "Ravi Rao", "emergencyContactPhone": "+919876500000", "knownAllergies": "Penicillin" }
201 { "id": 1, "userId": 9, "firstName": "Asha", "lastName": "Rao", "dateOfBirth": "1990-05-17", "gender": "FEMALE", "email": "asha@mail.com",
      "phone": "+919876543210", "bloodGroup": "O+", "status": "ACTIVE", "createdAt": "2026-11-11T12:11:20Z", ... }
400 { "message": "Validation failed", "details": ["email: must be a well-formed email address", "phone: must be 7-15 digits, optional leading +"] }
409 { "message": "A patient with email 'asha@mail.com' is already registered" }
```

## Doctors (Doctor Service)

| Method & path | Roles | Notes |
|---|---|---|
| `POST /api/doctors` | A | validates hospital/department via Hospital Service (Feign); 409 duplicate license/e-mail/login |
| `GET /api/doctors?specialization=&hospitalId=&departmentId=&active=` | any | paged |
| `GET /api/doctors/specializations` | any | distinct specializations |
| `GET /api/doctors/available?date=&specialization=` | any | doctors working that day (+ slot count) |
| `GET /api/doctors/{id}` | any | cached |
| `PUT /api/doctors/{id}`, `DELETE /api/doctors/{id}` | A | |
| `GET /api/doctors/{id}/slots?date=` | any | slot grid (cached) |
| `GET /api/doctors/{id}/schedule` | any | weekly template |
| `PUT /api/doctors/{id}/schedule` | A, D(own) | replaces the template |
| `GET/POST /api/doctors/{id}/unavailability`, `DELETE .../{uid}` | any / A, D(own) | days off |

```json
POST /api/doctors
{ "firstName": "Ravi", "lastName": "Kumar", "email": "ravi@hospital.local", "phone": "+919900112233", "licenseNumber": "LIC-1001",
  "specialization": "Cardiology", "qualification": "MD", "experienceYears": 12, "consultationFee": 800, "hospitalId": 1, "departmentId": 1, "userId": 9 }
201 { "id": 1, "fullName": "Dr. Ravi Kumar", "specialization": "Cardiology", "consultationFee": 800.00, "hospitalId": 1, "departmentId": 1, "active": true, ... }

PUT /api/doctors/1/schedule
{ "days": [ { "dayOfWeek": "MONDAY", "startTime": "09:00", "endTime": "13:00", "slotMinutes": 30, "breakStart": "11:00", "breakEnd": "11:30" } ] }
200 [ { "dayOfWeek": "MONDAY", "startTime": "09:00:00", "endTime": "13:00:00", "slotMinutes": 30, "breakStart": "11:00:00", "breakEnd": "11:30:00" } ]

GET /api/doctors/1/slots?date=2026-11-16
200 [ { "startTime": "09:00:00", "endTime": "09:30:00", "available": true }, ... { "startTime": "10:30:00", ... }, { "startTime": "11:30:00", ... } ]   // no 11:00 slot - it is the break

POST /api/doctors/1/unavailability   { "date": "2026-11-17", "reason": "Conference" }  -> 201 { "id": 4, "date": "2026-11-17", "reason": "Conference" }
GET  /api/doctors/available?date=2026-11-16&specialization=Cardiology
200 [ { "doctor": { "id": 1, "fullName": "Dr. Ravi Kumar", ... }, "slotCount": 7, "firstSlot": "09:00:00", "lastSlotEnd": "13:00:00" } ]
```

## Appointments (Appointment Service)

| Method & path | Roles | Notes |
|---|---|---|
| `GET /api/appointments/availability?doctorId=&date=` | any | slots with `available` true/false (cached 60 s) |
| `POST /api/appointments` | A, P(own) | book |
| `GET /api/appointments/{id}` | A, D, P(own), ... | cached |
| `GET /api/appointments/my` | P | caller's appointments |
| `GET /api/appointments/patient/{patientId}` | A, D, P(own) | |
| `GET /api/appointments/doctor/{doctorId}?date=` | A, D | |
| `PUT /api/appointments/{id}/reschedule` | A, D(own), P(own) | |
| `PUT /api/appointments/{id}/cancel` | A, D(own), P(own) | body optional `{ "reason": ".." }` |
| `PUT /api/appointments/{id}/complete` | A, D(own) | only once the appointment time has started |

```json
POST /api/appointments { "patientId": 1, "doctorId": 1, "date": "2026-11-16", "startTime": "09:30", "reason": "Chest pain follow-up" }
201 { "id": 7, "patientId": 1, "patientName": "Asha Rao", "doctorId": 1, "doctorName": "Dr. Ravi Kumar", "date": "2026-11-16",
      "startTime": "09:30:00", "endTime": "10:00:00", "status": "BOOKED", "fee": 800.00, "paymentStatus": "NOT_BILLED", ... }
400 "The doctor does not offer a slot starting at 09:45 on 2026-11-16 (not a working day/hour, on a break, or on leave)"
409 "The doctor already has an appointment overlapping 09:30-10:00 on 2026-11-16"
503 "Doctor schedule is temporarily unavailable, please try again shortly"      // circuit breaker / downstream down

PUT /api/appointments/7/reschedule { "date": "2026-11-16", "startTime": "10:00" }
PUT /api/appointments/7/cancel     { "reason": "Change of plans" }
```
`paymentStatus` moves NOT_BILLED -> PENDING -> PAID (or FAILED) from billing events.

## Medical records (Medical Records Service)

| Method & path | Roles |
|---|---|
| `POST /api/records/entries` | A, D |
| `PUT /api/records/entries/{id}` | A, D (manual entries only) |
| `GET /api/records/entries/{id}` | A, D, P(own) |
| `GET /api/records/patients/{patientId}/entries?type=&page=&size=` | A, D, P(own) |
| `GET /api/records/patients/{patientId}/summary` | A, D, P(own) |
| `PUT /api/records/patients/{patientId}/conditions` | A, D |

```json
POST /api/records/entries { "patientId": 1, "entryType": "DIAGNOSIS", "title": "Mild anaemia", "details": "Hb 9.1 g/dL", "doctorId": 1 }
GET /api/records/patients/1/summary
200 { "patientId": 1, "patientName": "Asha Rao", "chronicConditions": null,
      "entryCounts": { "DIAGNOSIS": 1, "VISIT": 0, "LAB_REPORT": 1, "PRESCRIPTION": 1, "ALLERGY": 0, "NOTE": 0 }, "latestEntries": [ ... ] }
```

## Prescriptions (Prescription Service)

| Method & path | Roles |
|---|---|
| `POST /api/prescriptions` | A, D (own name) |
| `GET /api/prescriptions/{id}`, `GET /api/prescriptions/{id}/status` | any authenticated, P(own) |
| `GET /api/prescriptions/patient/{patientId}` | A, D, PH, P(own) |
| `GET /api/prescriptions/doctor/{doctorId}` | A, D |
| `PUT /api/prescriptions/{id}/cancel` | A, D(own) |

```json
POST /api/prescriptions
{ "patientId": 1, "doctorId": 1, "appointmentId": 7, "diagnosis": "Mild anaemia", "validDays": 30,
  "items": [ { "medicineName": "Paracetamol", "dosage": "500mg", "frequency": "TID", "durationDays": 5, "quantity": 15, "instructions": "after food" } ] }
201 { "id": 3, "status": "ACTIVE", "validUntil": "2026-12-11", "items": [ { "medicineName": "Paracetamol", "quantity": 15, ... } ], ... }
GET /api/prescriptions/3/status  -> { "id": 3, "status": "DISPENSED", "statusChangedAt": "2026-11-11T12:15:02Z" }
```

## Laboratory (Laboratory Service)

| Method & path | Roles |
|---|---|
| `GET /api/lab/tests` | any |
| `POST /api/lab/tests` | A, L |
| `POST /api/lab/requests` | A, D (own name) |
| `GET /api/lab/requests?status=&page=&size=` | A, D, L |
| `GET /api/lab/requests/{id}` | staff, P(own) |
| `GET /api/lab/requests/patient/{patientId}` | staff, P(own) |
| `PUT /api/lab/requests/{id}/status` | A, L - `{ "status": "SAMPLE_COLLECTED" \| "IN_PROGRESS" \| "CANCELLED" }` |
| `PUT /api/lab/requests/{id}/cancel` | A, D, L |
| `POST /api/lab/requests/{id}/report` | A, L (request must be IN_PROGRESS) |
| `GET /api/lab/requests/{id}/report` | A, D, L, P(own) |

```json
POST /api/lab/requests { "patientId": 1, "doctorId": 1, "testCode": "CBC", "priority": "URGENT", "clinicalNotes": "Fatigue" }
201 { "id": 2, "testCode": "CBC", "testName": "Complete Blood Count", "price": 350.00, "priority": "URGENT", "status": "REQUESTED", "accessionNumber": null, ... }
   // a moment later (Kafka consumer): "accessionNumber": "LAB-20261111-000002"
POST /api/lab/requests/2/report { "resultSummary": "Hemoglobin 9.1 g/dL (low)", "resultDetails": "WBC 6.2, Plt 250", "referenceRange": "Hb 12-16", "abnormal": true }
201 { "id": 1, "requestId": 2, "abnormal": true, "reportedBy": "labstaff1", "reportedAt": "..." }
409 "Invalid status change REQUESTED -> IN_PROGRESS"
```

## Billing (Billing Service)

| Method & path | Roles |
|---|---|
| `POST /api/bills` | A, B (manual bill) |
| `GET /api/bills?status=&page=&size=` | A, B |
| `GET /api/bills/{id}` | A, B, P(own) |
| `GET /api/bills/patient/{patientId}` | A, B, P(own) |
| `PUT /api/bills/{id}/cancel` | A, B |
| `POST /api/bills/{id}/payments` | A, B, P(own) - initiate |
| `GET /api/bills/{id}/payments` | A, B, P(own) |
| `GET /api/payments/{transactionRef}` | A, B, P(own) |
| `PUT /api/payments/{transactionRef}/status` | A, B - simulated gateway callback / cash & insurance confirmation |

```json
GET /api/bills/patient/1
200 [ { "id": 5, "billNumber": "BILL-20261111-000005", "billType": "APPOINTMENT", "referenceType": "APPOINTMENT", "referenceId": 7,
        "status": "PENDING", "totalAmount": 800.00, "paidAmount": 0.00, "currency": "INR", "dueDate": "2026-11-18",
        "items": [ { "description": "Consultation with Dr. Ravi Kumar on 2026-11-16 09:30", "quantity": 1, "unitPrice": 800.00, "amount": 800.00 } ] } ]

POST /api/bills/5/payments { "method": "UPI" }
201 { "transactionRef": "TXN-8F3A91C2D45E7B6A1C0D", "billNumber": "BILL-20261111-000005", "amount": 800.00, "method": "UPI", "status": "PENDING", ... }
POST /api/bills/5/payments { "method": "CARD", "simulateOutcome": "FAILURE" }  -> 201 { "status": "FAILED", "failureReason": "Declined by simulated gateway" }
PUT  /api/payments/TXN-8F3A91C2D45E7B6A1C0D/status { "status": "SUCCESS" }  -> 200 { "status": "SUCCESS", "completedAt": "..." }   // bill becomes PAID
409 "A payment for this bill is already in progress"
```
Allowed `method`: CARD, UPI, NET_BANKING, CASH, INSURANCE - no card number/CVV field exists anywhere in the API or database.

## Pharmacy (Pharmacy Service)

| Method & path | Roles |
|---|---|
| `GET /api/pharmacy/medicines` | A, PH, D |
| `POST /api/pharmacy/medicines`, `PUT .../{id}`, `POST .../{id}/restock` | A, PH |
| `GET /api/pharmacy/orders?status=` | A, PH |
| `GET /api/pharmacy/orders/{id}` | A, PH |
| `GET /api/pharmacy/orders/prescription/{prescriptionId}` | A, PH, D |
| `POST /api/pharmacy/orders/{id}/dispense` | A, PH |
| `POST /api/pharmacy/orders/{id}/reject` | A, PH - `{ "reason": "..." }` |

```json
POST /api/pharmacy/medicines { "sku": "MED-AZI250", "name": "Azithromycin 250mg", "genericName": "Azithromycin", "unitPrice": 12.50, "stockQuantity": 200, "reorderLevel": 30 }
POST /api/pharmacy/orders/4/dispense
200 { "id": 4, "prescriptionId": 3, "status": "DISPENSED", "totalAmount": 45.00, "dispensedBy": "pharmacist1",
      "items": [ { "medicineName": "Paracetamol", "quantity": 15, "unitPrice": 2.50, "inStock": true }, ... ] }
409 "Cannot dispense - Unobtainium: not in inventory"
409 "Prescription 3 is CANCELLED and cannot be dispensed"
```

## Notifications (Notification Service)

| Method & path | Roles |
|---|---|
| `GET /api/notifications?eventType=&email=&page=&size=` | A |
| `GET /api/notifications/my` | any (messages addressed to the caller's e-mail) |
| `GET /api/notifications/{id}` | A |
| `POST /api/notifications/send` | A - `{ "recipientEmail", "subject", "message" }` |

```json
GET /api/notifications?eventType=APPOINTMENT_BOOKED
200 { "content": [ { "id": 11, "recipientEmail": "asha@mail.com", "channel": "EMAIL", "subject": "Appointment confirmed",
      "message": "Your appointment with Dr. Ravi Kumar is confirmed for 2026-11-16 09:30:00-10:00:00. Consultation fee: 800.00.",
      "eventType": "APPOINTMENT_BOOKED", "referenceId": "7", "status": "SENT" } ], "totalElements": 2, ... }
```

## Gateway behaviour worth knowing
* `GET /internal/...`, `/ping`, `/actuator/...` -> 403; an unrouted path with a valid token -> 404 JSON; invalid/missing token -> 401 JSON.
* A stopped downstream service -> 503 JSON from the gateway; a slow one -> 504 (`spring.cloud.gateway.httpclient.response-timeout: 15s`).
