import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { DEFAULT_PORTS } from '../constants/index.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
dotenv.config({ path: path.join(root, '.env') });      // repo-level .env (git-ignored); real environment variables win
process.env.KAFKAJS_NO_PARTITIONER_WARNING ??= '1';   // we use KafkaJS' default (murmur2) partitioner on purpose

const int = (v, d) => (v === undefined || v === '' || Number.isNaN(Number(v)) ? d : Number(v));
const E = process.env;

/** Builds the MySQL URL for Prisma. The password is only ever read from the environment (MYSQL_PASSWORD). */
export function databaseUrl(dbName) {
  if (!E.MYSQL_PASSWORD) throw new Error('MYSQL_PASSWORD is not set (see .env.example)');
  const user = encodeURIComponent(E.MYSQL_USER ?? 'abhig');
  const pwd = encodeURIComponent(E.MYSQL_PASSWORD);
  return `mysql://${user}:${pwd}@${E.MYSQL_HOST ?? 'localhost'}:${E.MYSQL_PORT ?? 3306}/${dbName}?connection_limit=10`;
}

/** Service addresses: one place, environment-overridable, shared by HTTP clients, gRPC clients and the gateway. */
export function serviceUrls() {
  const http = (name, def) => E[`${name.toUpperCase().replace('-', '_')}_SERVICE_URL`] ?? `http://localhost:${def}`;
  const grpc = (name, def) => E[`${name.toUpperCase().replace('-', '_')}_GRPC_ADDRESS`] ?? `localhost:${def}`;
  const P = DEFAULT_PORTS;
  return {
    http: Object.fromEntries(['patient', 'doctor', 'appointment', 'hospital', 'medical-records', 'prescription', 'laboratory', 'billing', 'pharmacy', 'notification'].map((n) => [n, http(n, P[n])])),
    grpc: { patient: grpc('patient', P.grpc.patient), doctor: grpc('doctor', P.grpc.doctor), hospital: grpc('hospital', P.grpc.hospital) },
  };
}

export function loadConfig(service, { dbName, defaultPort, grpcPort } = {}) {
  return {
    service,
    env: E.NODE_ENV ?? 'development',
    port: int(E.PORT, defaultPort ?? DEFAULT_PORTS[service]),
    grpcPort: grpcPort ? int(E.GRPC_PORT, grpcPort) : null,
    dbName,
    databaseUrl: dbName ? databaseUrl(dbName) : null,
    log: { level: E.LOG_LEVEL ?? 'info', dir: E.LOG_DIR ?? path.join(root, 'logs') },
    kafka: { brokers: (E.KAFKA_BROKERS ?? `localhost:${DEFAULT_PORTS.kafka}`).split(','), outboxIntervalMs: int(E.OUTBOX_INTERVAL_MS, 1000), maxAttempts: int(E.KAFKA_MAX_ATTEMPTS, 3), retryBaseMs: int(E.KAFKA_RETRY_BASE_MS, 500) },
    redis: { url: E.REDIS_URL ?? `redis://localhost:${DEFAULT_PORTS.redis}` },
    jwt: {
      secret: E.JWT_SECRET ?? 'hospital-mgmt-node-local-dev-signing-key-change-me-0123456789',
      issuer: E.JWT_ISSUER ?? 'hospital-identity',
      audience: E.JWT_AUDIENCE ?? 'hospital-api',
      accessTtl: E.JWT_ACCESS_TTL ?? '15m',
      refreshTtlDays: int(E.JWT_REFRESH_TTL_DAYS, 7),
    },
    services: serviceUrls(),
    http: { timeoutMs: int(E.HTTP_TIMEOUT_MS, 4000) },
    cache: {
      patientSec: int(E.CACHE_PATIENT_SEC, 600), doctorSec: int(E.CACHE_DOCTOR_SEC, 900), hospitalSec: int(E.CACHE_HOSPITAL_SEC, 1800),
      slotsSec: int(E.CACHE_SLOTS_SEC, 300), availabilitySec: int(E.CACHE_AVAILABILITY_SEC, 60), appointmentSec: int(E.CACHE_APPOINTMENT_SEC, 300),
    },
    jobs: {
      disabled: E.JOBS_DISABLED === 'true',
      reminderCron: E.REMINDER_CRON ?? '*/1 * * * *', reminderLeadHours: int(E.REMINDER_LEAD_HOURS, 24),
      missedCron: E.MISSED_CRON ?? '*/5 * * * *',
      pendingPaymentsCron: E.PENDING_PAYMENTS_CRON ?? '*/1 * * * *', paymentTimeoutMinutes: int(E.PAYMENT_TIMEOUT_MINUTES, 30),
      overdueCron: E.OVERDUE_CRON ?? '*/5 * * * *', billReminderHours: int(E.BILL_REMINDER_HOURS, 24), billDueDays: int(E.BILL_DUE_DAYS, 7),
      expiryCron: E.PRESCRIPTION_EXPIRY_CRON ?? '*/10 * * * *', prescriptionValidityDays: int(E.PRESCRIPTION_VALIDITY_DAYS, 30),
      lowStockCron: E.LOW_STOCK_CRON ?? '*/10 * * * *', lowStockAlertHours: int(E.LOW_STOCK_ALERT_HOURS, 24), pharmacyAlertEmail: E.PHARMACY_ALERT_EMAIL ?? 'pharmacy.admin@hospital.local',
      deliveryCron: E.DELIVERY_CRON ?? '*/5 * * * * *',       // notification delivery worker (6-field cron = seconds)
    },
    seed: { adminPassword: E.SEED_ADMIN_PASSWORD ?? 'Admin@123', staffPassword: E.SEED_STAFF_PASSWORD ?? 'Staff@123' },
    uploadDir: E.UPLOAD_DIR ?? path.join(root, 'uploads'),
  };
}
export { root as repoRoot };
