#!/usr/bin/env bash
# Shared helpers: project root, .env loading, dotnet on PATH, service table (name:project:port).
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export PATH="$HOME/.dotnet:$HOME/.dotnet/tools:$PATH"
if [ -f "$ROOT/.env" ]; then set -a; . "$ROOT/.env"; set +a; fi
RUN_DIR="$ROOT/.run"; LOG_DIR="$ROOT/logs"; PUBLISH_DIR="$ROOT/.publish"; mkdir -p "$RUN_DIR" "$LOG_DIR"
export LOG_DIR
# order matters: identity/reference services first, then the ones that call them
SERVICES=(
  "hospital-service:HospitalService:28104:HospitalDB"
  "patient-service:PatientService:28101:PatientDB"
  "doctor-service:DoctorService:28102:DoctorDB"
  "appointment-service:AppointmentService:28103:AppointmentDB"
  "medical-records-service:MedicalRecordsService:28105:MedicalRecordsDB"
  "prescription-service:PrescriptionService:28106:PrescriptionDB"
  "laboratory-service:LaboratoryService:28107:LaboratoryDB"
  "billing-service:BillingService:28108:BillingDB"
  "pharmacy-service:PharmacyService:28109:PharmacyDB"
  "notification-service:NotificationService:28110:NotificationDB"
)
GATEWAY="api-gateway:ApiGateway:28080:"
