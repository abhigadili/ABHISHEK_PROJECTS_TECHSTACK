# 5. Database schema and table details

MySQL (the **existing** local server, port 3306, user `abhig`), one database per microservice. A service only ever connects to its own database; there are **no foreign keys across databases** - other services' ids (`patient_id`, `doctor_id`, `user_id`, `hospital_id` ...) are plain "logical" columns that are validated through the owning service's API.

| Database | Owner | Tables | Script |
|---|---|---|---|
| HospitalDB | Hospital Service | hospitals, departments, users, outbox_events, processed_events | `database/scripts/11-HospitalDB-schema.sql` |
| PatientDB | Patient Service | patients, outbox_events, processed_events | `12-PatientDB-schema.sql` |
| DoctorDB | Doctor Service | doctors, doctor_schedules, doctor_unavailability, outbox_events, processed_events | `13-DoctorDB-schema.sql` |
| AppointmentDB | Appointment Service | appointments, outbox_events, processed_events | `14-AppointmentDB-schema.sql` |
| MedicalRecordsDB | Medical Records Service | patient_records, record_entries, outbox_events, processed_events | `15-MedicalRecordsDB-schema.sql` |
| PrescriptionDB | Prescription Service | prescriptions, prescription_items, outbox_events, processed_events | `16-PrescriptionDB-schema.sql` |
| LaboratoryDB | Laboratory Service | lab_tests, lab_requests, lab_reports, outbox_events, processed_events | `17-LaboratoryDB-schema.sql` |
| BillingDB | Billing Service | bills, bill_items, payments, outbox_events, processed_events | `18-BillingDB-schema.sql` |
| PharmacyDB | Pharmacy Service | medicines, pharmacy_orders, pharmacy_order_items, outbox_events, processed_events | `19-PharmacyDB-schema.sql` |
| NotificationDB | Notification Service | `hms_notifications`, `hms_outbox_events`, `hms_processed_events` | `20-NotificationDB-schema.sql` |

**Total: 42 tables.** `outbox_events` and `processed_events` are the two infrastructure tables used for reliable messaging (see the Kafka document).

> **NotificationDB pre-existed.** It already belonged to another application on this server (tables `Notifications`, `Email_Logs`, `SMS_Logs`, `sms_*`, `dn_*`, `flyway_schema_history`, `__EFMigrationsHistory`). Nothing there was touched: `CREATE DATABASE IF NOT EXISTS` is a no-op for it and this project's tables are created next to the existing ones with the prefix `hms_`. The other nine databases were created by this project (they did not exist).

## How the schema is created and verified
* `database/scripts/00-create-databases.sql` - ten `CREATE DATABASE IF NOT EXISTS` statements (utf8mb4).
* `database/scripts/11..20-*-schema.sql` - `CREATE TABLE IF NOT EXISTS` per database (generated from the Hibernate mappings with `mysqldump --no-data`, FK checks disabled only for the duration of the script because the tables are listed alphabetically). Re-running never drops or alters anything.
* `scripts/create-databases.sh` applies them; `scripts/verify-db.sh` is a read-only connectivity/table-count check for every service.
* The services run with `spring.jpa.hibernate.ddl-auto=validate` - Hibernate **verifies** the mappings against these tables at start-up and refuses to start on a mismatch (set `DDL_AUTO=update` only for local experiments). The scripts were additionally tested by applying them to a throw-away database (26 business tables created without error).

## Modelling notes
* **Ids:** `BIGINT AUTO_INCREMENT` surrogate keys everywhere. Business numbers (`bill_number`, `transaction_ref`, `accession_number`) have unique indexes.
* **Money:** `DECIMAL(10,2)` / `DECIMAL(12,2)`, never floating point. Currency is stored on the bill (`INR`).
* **Times:** `DATE`, `TIME(6)`, `DATETIME(6)` (UTC for instants via `hibernate.jdbc.time_zone=UTC`).
* **Enums** are stored as strings (`@Enumerated(STRING)`), so adding a value never shifts meaning.
* **Optimistic locking** (`version`) on patients, appointments, bills, lab requests and medicines; **pessimistic** row locks only for stock decrement in Pharmacy.
* **Integrity rules in the schema** (not only in code): `patients` unique `user_id`/`email`/`phone`/`identity_number`; `doctors` unique `license_number`/`email`/`user_id`; `appointments.slot_key` unique while booked (NULL when cancelled/missed so the slot is free again); `bills` unique `(reference_type, reference_id)`; `payments.transaction_ref`; `pharmacy_orders.prescription_id`; `lab_requests.accession_number`; `lab_reports.request_id`; `record_entries (entry_type, reference_type, reference_id)`; `processed_events (event_id, consumer)`.
* **Foreign keys** exist only inside a database: departments->hospitals, schedules/unavailability->doctors, record_entries->patient_records, prescription_items->prescriptions, lab_requests->lab_tests, lab_reports->lab_requests, bill_items/payments->bills, pharmacy_order_items->pharmacy_orders/medicines.
* **Indexes** target the real queries: doctor search by specialization/hospital, appointment lookup by doctor+date and patient, reminder scan `(status, reminder_sent, appointment_date)`, bills by patient and by `(status, due_date)`, payments by `(status, initiated_at)`, notifications by recipient and by event, outbox `(sent_at, created_at)`.

# Table reference (generated from the live schema)

## HospitalDB - Hospital Service

### `HospitalDB.departments`

| Column | Type | Null | Key / default |
|---|---|---|---|
| `id` | `bigint` | NO | PRI auto_increment |
| `active` | `bit(1)` | NO |  |
| `description` | `varchar(255)` | YES |  |
| `name` | `varchar(100)` | NO |  |
| `hospital_id` | `bigint` | NO | MUL |

**Indexes / unique constraints:** `uk_department_hospital_name` (unique hospital_id,name)

**Foreign keys (same database only):** `fk_department_hospital`: hospital_id -> hospitals.id

### `HospitalDB.hospitals`

| Column | Type | Null | Key / default |
|---|---|---|---|
| `id` | `bigint` | NO | PRI auto_increment |
| `active` | `bit(1)` | NO |  |
| `address` | `varchar(255)` | YES |  |
| `city` | `varchar(80)` | YES | MUL |
| `code` | `varchar(30)` | NO | UNI |
| `created_at` | `datetime(6)` | NO |  |
| `email` | `varchar(120)` | YES |  |
| `name` | `varchar(150)` | NO |  |
| `phone` | `varchar(30)` | YES |  |

**Indexes / unique constraints:** `idx_hospital_city` (city); `uk_hospital_code` (unique code)

### `HospitalDB.outbox_events`

| Column | Type | Null | Key / default |
|---|---|---|---|
| `id` | `bigint` | NO | PRI auto_increment |
| `attempts` | `int` | NO |  |
| `created_at` | `datetime(6)` | NO |  |
| `event_key` | `varchar(100)` | YES |  |
| `payload` | `mediumtext` | NO |  |
| `sent_at` | `datetime(6)` | YES | MUL |
| `topic` | `varchar(150)` | NO |  |

**Indexes / unique constraints:** `idx_outbox_unsent` (sent_at,created_at)

### `HospitalDB.processed_events`

| Column | Type | Null | Key / default |
|---|---|---|---|
| `id` | `bigint` | NO | PRI auto_increment |
| `consumer` | `varchar(120)` | NO |  |
| `event_id` | `varchar(64)` | NO | MUL |
| `processed_at` | `datetime(6)` | NO |  |

**Indexes / unique constraints:** `uk_processed_event_consumer` (unique event_id,consumer)

### `HospitalDB.users`

| Column | Type | Null | Key / default |
|---|---|---|---|
| `id` | `bigint` | NO | PRI auto_increment |
| `created_at` | `datetime(6)` | NO |  |
| `email` | `varchar(120)` | NO | UNI |
| `enabled` | `bit(1)` | NO |  |
| `last_login_at` | `datetime(6)` | YES |  |
| `password_hash` | `varchar(100)` | NO |  |
| `role` | `enum('ADMIN','BILLING_STAFF','DOCTOR','LAB_STAFF','PATIENT','PHARMACIST')` | NO |  |
| `username` | `varchar(60)` | NO | UNI |

**Indexes / unique constraints:** `uk_user_email` (unique email); `uk_user_username` (unique username)

## PatientDB - Patient Service

### `PatientDB.outbox_events`

| Column | Type | Null | Key / default |
|---|---|---|---|
| `id` | `bigint` | NO | PRI auto_increment |
| `attempts` | `int` | NO |  |
| `created_at` | `datetime(6)` | NO |  |
| `event_key` | `varchar(100)` | YES |  |
| `payload` | `mediumtext` | NO |  |
| `sent_at` | `datetime(6)` | YES | MUL |
| `topic` | `varchar(150)` | NO |  |

**Indexes / unique constraints:** `idx_outbox_unsent` (sent_at,created_at)

### `PatientDB.patients`

| Column | Type | Null | Key / default |
|---|---|---|---|
| `id` | `bigint` | NO | PRI auto_increment |
| `address` | `varchar(255)` | YES |  |
| `blood_group` | `varchar(5)` | YES |  |
| `created_at` | `datetime(6)` | NO |  |
| `date_of_birth` | `date` | NO |  |
| `email` | `varchar(120)` | NO | UNI |
| `emergency_contact_name` | `varchar(100)` | YES |  |
| `emergency_contact_phone` | `varchar(20)` | YES |  |
| `first_name` | `varchar(60)` | NO |  |
| `gender` | `enum('FEMALE','MALE','OTHER')` | NO |  |
| `identity_number` | `varchar(40)` | YES | UNI |
| `known_allergies` | `varchar(500)` | YES |  |
| `last_name` | `varchar(60)` | NO | MUL |
| `phone` | `varchar(20)` | NO | UNI |
| `status` | `enum('ACTIVE','INACTIVE')` | NO |  |
| `updated_at` | `datetime(6)` | NO |  |
| `user_id` | `bigint` | YES | UNI |
| `version` | `bigint` | YES |  |

**Indexes / unique constraints:** `idx_patient_name` (last_name,first_name); `uk_patient_email` (unique email); `uk_patient_identity` (unique identity_number); `uk_patient_phone` (unique phone); `uk_patient_user` (unique user_id)

### `PatientDB.processed_events`

| Column | Type | Null | Key / default |
|---|---|---|---|
| `id` | `bigint` | NO | PRI auto_increment |
| `consumer` | `varchar(120)` | NO |  |
| `event_id` | `varchar(64)` | NO | MUL |
| `processed_at` | `datetime(6)` | NO |  |

**Indexes / unique constraints:** `uk_processed_event_consumer` (unique event_id,consumer)

## DoctorDB - Doctor Service

### `DoctorDB.doctor_schedules`

| Column | Type | Null | Key / default |
|---|---|---|---|
| `id` | `bigint` | NO | PRI auto_increment |
| `break_end` | `time(6)` | YES |  |
| `break_start` | `time(6)` | YES |  |
| `day_of_week` | `enum('FRIDAY','MONDAY','SATURDAY','SUNDAY','THURSDAY','TUESDAY','WEDNESDAY')` | NO |  |
| `end_time` | `time(6)` | NO |  |
| `slot_minutes` | `int` | NO |  |
| `start_time` | `time(6)` | NO |  |
| `doctor_id` | `bigint` | NO | MUL |

**Indexes / unique constraints:** `uk_schedule_doctor_day` (unique doctor_id,day_of_week)

**Foreign keys (same database only):** `fk_schedule_doctor`: doctor_id -> doctors.id

### `DoctorDB.doctor_unavailability`

| Column | Type | Null | Key / default |
|---|---|---|---|
| `id` | `bigint` | NO | PRI auto_increment |
| `reason` | `varchar(200)` | YES |  |
| `unavailable_date` | `date` | NO |  |
| `doctor_id` | `bigint` | NO | MUL |

**Indexes / unique constraints:** `uk_unavailable_doctor_date` (unique doctor_id,unavailable_date)

**Foreign keys (same database only):** `fk_unavailable_doctor`: doctor_id -> doctors.id

### `DoctorDB.doctors`

| Column | Type | Null | Key / default |
|---|---|---|---|
| `id` | `bigint` | NO | PRI auto_increment |
| `active` | `bit(1)` | NO |  |
| `consultation_fee` | `decimal(10,2)` | NO |  |
| `created_at` | `datetime(6)` | NO |  |
| `department_id` | `bigint` | YES |  |
| `email` | `varchar(120)` | NO | UNI |
| `experience_years` | `int` | YES |  |
| `first_name` | `varchar(60)` | NO |  |
| `hospital_id` | `bigint` | NO | MUL |
| `last_name` | `varchar(60)` | NO |  |
| `license_number` | `varchar(40)` | NO | UNI |
| `phone` | `varchar(20)` | YES |  |
| `qualification` | `varchar(150)` | YES |  |
| `specialization` | `varchar(80)` | NO | MUL |
| `user_id` | `bigint` | YES | UNI |

**Indexes / unique constraints:** `idx_doctor_hospital` (hospital_id,department_id); `idx_doctor_specialization` (specialization,active); `uk_doctor_email` (unique email); `uk_doctor_license` (unique license_number); `uk_doctor_user` (unique user_id)

### `DoctorDB.outbox_events`

| Column | Type | Null | Key / default |
|---|---|---|---|
| `id` | `bigint` | NO | PRI auto_increment |
| `attempts` | `int` | NO |  |
| `created_at` | `datetime(6)` | NO |  |
| `event_key` | `varchar(100)` | YES |  |
| `payload` | `mediumtext` | NO |  |
| `sent_at` | `datetime(6)` | YES | MUL |
| `topic` | `varchar(150)` | NO |  |

**Indexes / unique constraints:** `idx_outbox_unsent` (sent_at,created_at)

### `DoctorDB.processed_events`

| Column | Type | Null | Key / default |
|---|---|---|---|
| `id` | `bigint` | NO | PRI auto_increment |
| `consumer` | `varchar(120)` | NO |  |
| `event_id` | `varchar(64)` | NO | MUL |
| `processed_at` | `datetime(6)` | NO |  |

**Indexes / unique constraints:** `uk_processed_event_consumer` (unique event_id,consumer)

## AppointmentDB - Appointment Service

### `AppointmentDB.appointments`

| Column | Type | Null | Key / default |
|---|---|---|---|
| `id` | `bigint` | NO | PRI auto_increment |
| `appointment_date` | `date` | NO |  |
| `bill_number` | `varchar(40)` | YES |  |
| `cancel_reason` | `varchar(255)` | YES |  |
| `created_at` | `datetime(6)` | NO |  |
| `doctor_email` | `varchar(120)` | YES |  |
| `doctor_id` | `bigint` | NO | MUL |
| `doctor_name` | `varchar(125)` | NO |  |
| `end_time` | `time(6)` | NO |  |
| `fee` | `decimal(10,2)` | NO |  |
| `notes` | `varchar(1000)` | YES |  |
| `patient_email` | `varchar(120)` | YES |  |
| `patient_id` | `bigint` | NO | MUL |
| `patient_name` | `varchar(121)` | NO |  |
| `payment_status` | `enum('FAILED','NOT_BILLED','PAID','PENDING')` | NO |  |
| `reason` | `varchar(255)` | YES |  |
| `reminder_sent` | `bit(1)` | NO |  |
| `slot_key` | `varchar(80)` | YES | UNI |
| `start_time` | `time(6)` | NO |  |
| `status` | `enum('BOOKED','CANCELLED','COMPLETED','MISSED')` | NO | MUL |
| `updated_at` | `datetime(6)` | NO |  |
| `version` | `bigint` | YES |  |

**Indexes / unique constraints:** `idx_appt_doctor_date` (doctor_id,appointment_date,status); `idx_appt_patient` (patient_id,appointment_date); `idx_appt_reminder` (status,reminder_sent,appointment_date); `uk_appointment_slot` (unique slot_key)

### `AppointmentDB.outbox_events`

| Column | Type | Null | Key / default |
|---|---|---|---|
| `id` | `bigint` | NO | PRI auto_increment |
| `attempts` | `int` | NO |  |
| `created_at` | `datetime(6)` | NO |  |
| `event_key` | `varchar(100)` | YES |  |
| `payload` | `mediumtext` | NO |  |
| `sent_at` | `datetime(6)` | YES | MUL |
| `topic` | `varchar(150)` | NO |  |

**Indexes / unique constraints:** `idx_outbox_unsent` (sent_at,created_at)

### `AppointmentDB.processed_events`

| Column | Type | Null | Key / default |
|---|---|---|---|
| `id` | `bigint` | NO | PRI auto_increment |
| `consumer` | `varchar(120)` | NO |  |
| `event_id` | `varchar(64)` | NO | MUL |
| `processed_at` | `datetime(6)` | NO |  |

**Indexes / unique constraints:** `uk_processed_event_consumer` (unique event_id,consumer)

## MedicalRecordsDB - Medical Records Service

### `MedicalRecordsDB.outbox_events`

| Column | Type | Null | Key / default |
|---|---|---|---|
| `id` | `bigint` | NO | PRI auto_increment |
| `attempts` | `int` | NO |  |
| `created_at` | `datetime(6)` | NO |  |
| `event_key` | `varchar(100)` | YES |  |
| `payload` | `mediumtext` | NO |  |
| `sent_at` | `datetime(6)` | YES | MUL |
| `topic` | `varchar(150)` | NO |  |

**Indexes / unique constraints:** `idx_outbox_unsent` (sent_at,created_at)

### `MedicalRecordsDB.patient_records`

| Column | Type | Null | Key / default |
|---|---|---|---|
| `id` | `bigint` | NO | PRI auto_increment |
| `chronic_conditions` | `varchar(500)` | YES |  |
| `created_at` | `datetime(6)` | NO |  |
| `patient_id` | `bigint` | NO | UNI |
| `patient_name` | `varchar(121)` | NO |  |
| `updated_at` | `datetime(6)` | NO |  |

**Indexes / unique constraints:** `uk_record_patient` (unique patient_id)

### `MedicalRecordsDB.processed_events`

| Column | Type | Null | Key / default |
|---|---|---|---|
| `id` | `bigint` | NO | PRI auto_increment |
| `consumer` | `varchar(120)` | NO |  |
| `event_id` | `varchar(64)` | NO | MUL |
| `processed_at` | `datetime(6)` | NO |  |

**Indexes / unique constraints:** `uk_processed_event_consumer` (unique event_id,consumer)

### `MedicalRecordsDB.record_entries`

| Column | Type | Null | Key / default |
|---|---|---|---|
| `id` | `bigint` | NO | PRI auto_increment |
| `details` | `varchar(4000)` | YES |  |
| `doctor_id` | `bigint` | YES |  |
| `entry_type` | `enum('ALLERGY','DIAGNOSIS','LAB_REPORT','NOTE','PRESCRIPTION','VISIT')` | NO | MUL |
| `patient_id` | `bigint` | NO | MUL |
| `recorded_at` | `datetime(6)` | NO |  |
| `reference_id` | `bigint` | YES |  |
| `reference_type` | `varchar(30)` | YES |  |
| `source` | `varchar(10)` | NO |  |
| `title` | `varchar(200)` | NO |  |
| `record_id` | `bigint` | NO | MUL |

**Indexes / unique constraints:** `fk_entry_record` (record_id); `idx_entry_patient_time` (patient_id,recorded_at); `uk_entry_reference` (unique entry_type,reference_type,reference_id)

**Foreign keys (same database only):** `fk_entry_record`: record_id -> patient_records.id

## PrescriptionDB - Prescription Service

### `PrescriptionDB.outbox_events`

| Column | Type | Null | Key / default |
|---|---|---|---|
| `id` | `bigint` | NO | PRI auto_increment |
| `attempts` | `int` | NO |  |
| `created_at` | `datetime(6)` | NO |  |
| `event_key` | `varchar(100)` | YES |  |
| `payload` | `mediumtext` | NO |  |
| `sent_at` | `datetime(6)` | YES | MUL |
| `topic` | `varchar(150)` | NO |  |

**Indexes / unique constraints:** `idx_outbox_unsent` (sent_at,created_at)

### `PrescriptionDB.prescription_items`

| Column | Type | Null | Key / default |
|---|---|---|---|
| `id` | `bigint` | NO | PRI auto_increment |
| `dosage` | `varchar(60)` | NO |  |
| `duration_days` | `int` | NO |  |
| `frequency` | `varchar(80)` | NO |  |
| `instructions` | `varchar(255)` | YES |  |
| `medicine_name` | `varchar(150)` | NO |  |
| `quantity` | `int` | NO |  |
| `prescription_id` | `bigint` | NO | MUL |

**Indexes / unique constraints:** `fk_rx_item_prescription` (prescription_id)

**Foreign keys (same database only):** `fk_rx_item_prescription`: prescription_id -> prescriptions.id

### `PrescriptionDB.prescriptions`

| Column | Type | Null | Key / default |
|---|---|---|---|
| `id` | `bigint` | NO | PRI auto_increment |
| `appointment_id` | `bigint` | YES |  |
| `diagnosis` | `varchar(500)` | YES |  |
| `doctor_id` | `bigint` | NO |  |
| `doctor_name` | `varchar(125)` | NO |  |
| `issued_at` | `datetime(6)` | NO |  |
| `notes` | `varchar(1000)` | YES |  |
| `patient_email` | `varchar(120)` | YES |  |
| `patient_id` | `bigint` | NO | MUL |
| `patient_name` | `varchar(121)` | NO |  |
| `status` | `enum('ACTIVE','CANCELLED','DISPENSED','EXPIRED')` | NO | MUL |
| `status_changed_at` | `datetime(6)` | YES |  |
| `valid_until` | `date` | NO |  |

**Indexes / unique constraints:** `idx_rx_patient` (patient_id,issued_at); `idx_rx_status_valid` (status,valid_until)

### `PrescriptionDB.processed_events`

| Column | Type | Null | Key / default |
|---|---|---|---|
| `id` | `bigint` | NO | PRI auto_increment |
| `consumer` | `varchar(120)` | NO |  |
| `event_id` | `varchar(64)` | NO | MUL |
| `processed_at` | `datetime(6)` | NO |  |

**Indexes / unique constraints:** `uk_processed_event_consumer` (unique event_id,consumer)

## LaboratoryDB - Laboratory Service

### `LaboratoryDB.lab_reports`

| Column | Type | Null | Key / default |
|---|---|---|---|
| `id` | `bigint` | NO | PRI auto_increment |
| `abnormal` | `bit(1)` | NO |  |
| `reference_range` | `varchar(200)` | YES |  |
| `reported_at` | `datetime(6)` | NO |  |
| `reported_by` | `varchar(60)` | NO |  |
| `result_details` | `varchar(4000)` | YES |  |
| `result_summary` | `varchar(1000)` | NO |  |
| `request_id` | `bigint` | NO | UNI |

**Indexes / unique constraints:** `uk_report_request` (unique request_id)

**Foreign keys (same database only):** `fk_report_request`: request_id -> lab_requests.id

### `LaboratoryDB.lab_requests`

| Column | Type | Null | Key / default |
|---|---|---|---|
| `id` | `bigint` | NO | PRI auto_increment |
| `accession_number` | `varchar(40)` | YES | UNI |
| `appointment_id` | `bigint` | YES |  |
| `clinical_notes` | `varchar(500)` | YES |  |
| `doctor_id` | `bigint` | NO |  |
| `patient_email` | `varchar(120)` | YES |  |
| `patient_id` | `bigint` | NO | MUL |
| `patient_name` | `varchar(121)` | NO |  |
| `price` | `decimal(10,2)` | NO |  |
| `priority` | `enum('ROUTINE','STAT','URGENT')` | NO |  |
| `queued_at` | `datetime(6)` | YES |  |
| `requested_at` | `datetime(6)` | NO |  |
| `status` | `enum('CANCELLED','COMPLETED','IN_PROGRESS','REQUESTED','SAMPLE_COLLECTED')` | NO | MUL |
| `test_name` | `varchar(150)` | NO |  |
| `updated_at` | `datetime(6)` | NO |  |
| `version` | `bigint` | YES |  |
| `test_id` | `bigint` | NO | MUL |

**Indexes / unique constraints:** `fk_lab_request_test` (test_id); `idx_lab_patient` (patient_id,requested_at); `idx_lab_status` (status,priority); `uk_lab_accession` (unique accession_number)

**Foreign keys (same database only):** `fk_lab_request_test`: test_id -> lab_tests.id

### `LaboratoryDB.lab_tests`

| Column | Type | Null | Key / default |
|---|---|---|---|
| `id` | `bigint` | NO | PRI auto_increment |
| `active` | `bit(1)` | NO |  |
| `code` | `varchar(30)` | NO | UNI |
| `name` | `varchar(150)` | NO |  |
| `price` | `decimal(10,2)` | NO |  |
| `sample_type` | `varchar(60)` | YES |  |
| `turnaround_hours` | `int` | YES |  |

**Indexes / unique constraints:** `uk_lab_test_code` (unique code)

### `LaboratoryDB.outbox_events`

| Column | Type | Null | Key / default |
|---|---|---|---|
| `id` | `bigint` | NO | PRI auto_increment |
| `attempts` | `int` | NO |  |
| `created_at` | `datetime(6)` | NO |  |
| `event_key` | `varchar(100)` | YES |  |
| `payload` | `mediumtext` | NO |  |
| `sent_at` | `datetime(6)` | YES | MUL |
| `topic` | `varchar(150)` | NO |  |

**Indexes / unique constraints:** `idx_outbox_unsent` (sent_at,created_at)

### `LaboratoryDB.processed_events`

| Column | Type | Null | Key / default |
|---|---|---|---|
| `id` | `bigint` | NO | PRI auto_increment |
| `consumer` | `varchar(120)` | NO |  |
| `event_id` | `varchar(64)` | NO | MUL |
| `processed_at` | `datetime(6)` | NO |  |

**Indexes / unique constraints:** `uk_processed_event_consumer` (unique event_id,consumer)

## BillingDB - Billing Service

### `BillingDB.bill_items`

| Column | Type | Null | Key / default |
|---|---|---|---|
| `id` | `bigint` | NO | PRI auto_increment |
| `amount` | `decimal(12,2)` | NO |  |
| `description` | `varchar(200)` | NO |  |
| `quantity` | `int` | NO |  |
| `unit_price` | `decimal(12,2)` | NO |  |
| `bill_id` | `bigint` | NO | MUL |

**Indexes / unique constraints:** `fk_bill_item_bill` (bill_id)

**Foreign keys (same database only):** `fk_bill_item_bill`: bill_id -> bills.id

### `BillingDB.bills`

| Column | Type | Null | Key / default |
|---|---|---|---|
| `id` | `bigint` | NO | PRI auto_increment |
| `bill_number` | `varchar(40)` | NO | UNI |
| `bill_type` | `enum('APPOINTMENT','LAB','MEDICINE','OTHER')` | NO |  |
| `created_at` | `datetime(6)` | NO |  |
| `currency` | `varchar(3)` | NO |  |
| `due_date` | `date` | NO |  |
| `last_reminder_at` | `datetime(6)` | YES |  |
| `note` | `varchar(255)` | YES |  |
| `paid_amount` | `decimal(12,2)` | NO |  |
| `patient_email` | `varchar(120)` | YES |  |
| `patient_id` | `bigint` | NO | MUL |
| `patient_name` | `varchar(121)` | NO |  |
| `reference_id` | `bigint` | YES |  |
| `reference_type` | `varchar(20)` | YES | MUL |
| `status` | `enum('CANCELLED','OVERDUE','PAID','PENDING')` | NO | MUL |
| `total_amount` | `decimal(12,2)` | NO |  |
| `updated_at` | `datetime(6)` | NO |  |
| `version` | `bigint` | YES |  |

**Indexes / unique constraints:** `idx_bill_patient` (patient_id,created_at); `idx_bill_status_due` (status,due_date); `uk_bill_number` (unique bill_number); `uk_bill_reference` (unique reference_type,reference_id)

### `BillingDB.outbox_events`

| Column | Type | Null | Key / default |
|---|---|---|---|
| `id` | `bigint` | NO | PRI auto_increment |
| `attempts` | `int` | NO |  |
| `created_at` | `datetime(6)` | NO |  |
| `event_key` | `varchar(100)` | YES |  |
| `payload` | `mediumtext` | NO |  |
| `sent_at` | `datetime(6)` | YES | MUL |
| `topic` | `varchar(150)` | NO |  |

**Indexes / unique constraints:** `idx_outbox_unsent` (sent_at,created_at)

### `BillingDB.payments`

| Column | Type | Null | Key / default |
|---|---|---|---|
| `id` | `bigint` | NO | PRI auto_increment |
| `amount` | `decimal(12,2)` | NO |  |
| `completed_at` | `datetime(6)` | YES |  |
| `failure_reason` | `varchar(255)` | YES |  |
| `initiated_at` | `datetime(6)` | NO |  |
| `method` | `enum('CARD','CASH','INSURANCE','NET_BANKING','UPI')` | NO |  |
| `status` | `enum('FAILED','PENDING','SUCCESS')` | NO | MUL |
| `transaction_ref` | `varchar(40)` | NO | UNI |
| `bill_id` | `bigint` | NO | MUL |

**Indexes / unique constraints:** `fk_payment_bill` (bill_id); `idx_payment_status` (status,initiated_at); `uk_payment_txn` (unique transaction_ref)

**Foreign keys (same database only):** `fk_payment_bill`: bill_id -> bills.id

### `BillingDB.processed_events`

| Column | Type | Null | Key / default |
|---|---|---|---|
| `id` | `bigint` | NO | PRI auto_increment |
| `consumer` | `varchar(120)` | NO |  |
| `event_id` | `varchar(64)` | NO | MUL |
| `processed_at` | `datetime(6)` | NO |  |

**Indexes / unique constraints:** `uk_processed_event_consumer` (unique event_id,consumer)

## PharmacyDB - Pharmacy Service

### `PharmacyDB.medicines`

| Column | Type | Null | Key / default |
|---|---|---|---|
| `id` | `bigint` | NO | PRI auto_increment |
| `active` | `bit(1)` | NO |  |
| `generic_name` | `varchar(150)` | YES | MUL |
| `last_low_stock_alert_at` | `datetime(6)` | YES |  |
| `name` | `varchar(150)` | NO | MUL |
| `reorder_level` | `int` | NO |  |
| `sku` | `varchar(40)` | NO | UNI |
| `stock_quantity` | `int` | NO |  |
| `unit_price` | `decimal(10,2)` | NO |  |
| `version` | `bigint` | YES |  |

**Indexes / unique constraints:** `idx_medicine_generic` (generic_name); `idx_medicine_name` (name); `uk_medicine_sku` (unique sku)

### `PharmacyDB.outbox_events`

| Column | Type | Null | Key / default |
|---|---|---|---|
| `id` | `bigint` | NO | PRI auto_increment |
| `attempts` | `int` | NO |  |
| `created_at` | `datetime(6)` | NO |  |
| `event_key` | `varchar(100)` | YES |  |
| `payload` | `mediumtext` | NO |  |
| `sent_at` | `datetime(6)` | YES | MUL |
| `topic` | `varchar(150)` | NO |  |

**Indexes / unique constraints:** `idx_outbox_unsent` (sent_at,created_at)

### `PharmacyDB.pharmacy_order_items`

| Column | Type | Null | Key / default |
|---|---|---|---|
| `id` | `bigint` | NO | PRI auto_increment |
| `dosage` | `varchar(60)` | YES |  |
| `medicine_name` | `varchar(150)` | NO |  |
| `quantity` | `int` | NO |  |
| `unit_price` | `decimal(10,2)` | YES |  |
| `medicine_id` | `bigint` | YES | MUL |
| `order_id` | `bigint` | NO | MUL |

**Indexes / unique constraints:** `fk_order_item_medicine` (medicine_id); `fk_order_item_order` (order_id)

**Foreign keys (same database only):** `fk_order_item_medicine`: medicine_id -> medicines.id; `fk_order_item_order`: order_id -> pharmacy_orders.id

### `PharmacyDB.pharmacy_orders`

| Column | Type | Null | Key / default |
|---|---|---|---|
| `id` | `bigint` | NO | PRI auto_increment |
| `created_at` | `datetime(6)` | NO |  |
| `dispensed_at` | `datetime(6)` | YES |  |
| `dispensed_by` | `varchar(60)` | YES |  |
| `doctor_name` | `varchar(125)` | YES |  |
| `patient_email` | `varchar(120)` | YES |  |
| `patient_id` | `bigint` | NO |  |
| `patient_name` | `varchar(121)` | NO |  |
| `prescription_id` | `bigint` | NO | UNI |
| `rejection_reason` | `varchar(255)` | YES |  |
| `status` | `enum('DISPENSED','PENDING','REJECTED')` | NO | MUL |
| `total_amount` | `decimal(12,2)` | NO |  |

**Indexes / unique constraints:** `idx_order_status` (status,created_at); `uk_order_prescription` (unique prescription_id)

### `PharmacyDB.processed_events`

| Column | Type | Null | Key / default |
|---|---|---|---|
| `id` | `bigint` | NO | PRI auto_increment |
| `consumer` | `varchar(120)` | NO |  |
| `event_id` | `varchar(64)` | NO | MUL |
| `processed_at` | `datetime(6)` | NO |  |

**Indexes / unique constraints:** `uk_processed_event_consumer` (unique event_id,consumer)

## NotificationDB - Notification Service

### `NotificationDB.hms_notifications`

| Column | Type | Null | Key / default |
|---|---|---|---|
| `id` | `bigint` | NO | PRI auto_increment |
| `channel` | `enum('EMAIL','SMS')` | NO |  |
| `created_at` | `datetime(6)` | NO |  |
| `event_type` | `varchar(40)` | NO | MUL |
| `failure_reason` | `varchar(255)` | YES |  |
| `message` | `varchar(2000)` | NO |  |
| `recipient_email` | `varchar(120)` | NO | MUL |
| `recipient_phone` | `varchar(20)` | YES |  |
| `reference_id` | `varchar(40)` | YES |  |
| `sent_at` | `datetime(6)` | YES |  |
| `status` | `enum('FAILED','SENT')` | NO |  |
| `subject` | `varchar(200)` | NO |  |

**Indexes / unique constraints:** `idx_notification_event` (event_type,reference_id); `idx_notification_recipient` (recipient_email,created_at)

### `NotificationDB.hms_outbox_events`

| Column | Type | Null | Key / default |
|---|---|---|---|
| `id` | `bigint` | NO | PRI auto_increment |
| `attempts` | `int` | NO |  |
| `created_at` | `datetime(6)` | NO |  |
| `event_key` | `varchar(100)` | YES |  |
| `payload` | `mediumtext` | NO |  |
| `sent_at` | `datetime(6)` | YES | MUL |
| `topic` | `varchar(150)` | NO |  |

**Indexes / unique constraints:** `idx_outbox_unsent` (sent_at,created_at)

### `NotificationDB.hms_processed_events`

| Column | Type | Null | Key / default |
|---|---|---|---|
| `id` | `bigint` | NO | PRI auto_increment |
| `consumer` | `varchar(120)` | NO |  |
| `event_id` | `varchar(64)` | NO | MUL |
| `processed_at` | `datetime(6)` | NO |  |

**Indexes / unique constraints:** `uk_processed_event_consumer` (unique event_id,consumer)

