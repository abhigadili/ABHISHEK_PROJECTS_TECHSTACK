#!/usr/bin/env bash
# Shared helpers: repo root, .env, service table (dir:port:db).
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [ -f "$ROOT/.env" ]; then set -a; . "$ROOT/.env"; set +a; fi
RUN_DIR="$ROOT/.run"; LOG_DIR="${LOG_DIR:-$ROOT/logs}"; mkdir -p "$RUN_DIR" "$LOG_DIR"
SERVICES=(
  "hospital-service:30104:HospitalDB"
  "patient-service:30101:PatientDB"
  "doctor-service:30102:DoctorDB"
  "appointment-service:30103:AppointmentDB"
  "medical-records-service:30105:MedicalRecordsDB"
  "prescription-service:30106:PrescriptionDB"
  "laboratory-service:30107:LaboratoryDB"
  "billing-service:30108:BillingDB"
  "pharmacy-service:30109:PharmacyDB"
  "notification-service:30110:NotificationDB"
)
INIT=20261111000000_init
