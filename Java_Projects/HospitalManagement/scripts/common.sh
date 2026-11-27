#!/usr/bin/env bash
# Shared helpers: project root, .env loading, service table (name:port:module-dir).
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [ -f "$ROOT/.env" ]; then set -a; . "$ROOT/.env"; set +a; fi
RUN_DIR="$ROOT/.run"; LOG_DIR="$ROOT/logs"; mkdir -p "$RUN_DIR" "$LOG_DIR"
# order matters: identity first, then reference data, then the services that call them
SERVICES=(
  "hospital-service:18104:services/hospital-service"
  "patient-service:18101:services/patient-service"
  "doctor-service:18102:services/doctor-service"
  "appointment-service:18103:services/appointment-service"
  "medical-records-service:18105:services/medical-records-service"
  "prescription-service:18106:services/prescription-service"
  "laboratory-service:18107:services/laboratory-service"
  "billing-service:18108:services/billing-service"
  "pharmacy-service:18109:services/pharmacy-service"
  "notification-service:18110:services/notification-service"
)
DB_OF() { case "$1" in
  hospital-service) echo HospitalDB;; patient-service) echo PatientDB;; doctor-service) echo DoctorDB;;
  appointment-service) echo AppointmentDB;; medical-records-service) echo MedicalRecordsDB;;
  prescription-service) echo PrescriptionDB;; laboratory-service) echo LaboratoryDB;;
  billing-service) echo BillingDB;; pharmacy-service) echo PharmacyDB;; notification-service) echo NotificationDB;; esac; }
