export const ROLES = Object.freeze({
  ADMIN: 'ADMIN',
  DOCTOR: 'DOCTOR',
  PATIENT: 'PATIENT',
  LAB_STAFF: 'LAB_STAFF',
  PHARMACIST: 'PHARMACIST',
  BILLING_STAFF: 'BILLING_STAFF',
});
export const ALL_ROLES = Object.values(ROLES);

export const CORRELATION_HEADER = 'x-correlation-id';

/** Kafka topics (dead-letter topics are "<topic>.DLT"). */
export const TOPICS = Object.freeze({
  PATIENT_REGISTERED: 'hospital.patient.registered',
  APPOINTMENT_BOOKED: 'hospital.appointment.booked',
  APPOINTMENT_CANCELLED: 'hospital.appointment.cancelled',
  APPOINTMENT_RESCHEDULED: 'hospital.appointment.rescheduled',
  APPOINTMENT_COMPLETED: 'hospital.appointment.completed',
  LAB_TEST_REQUESTED: 'hospital.lab.test-requested',
  LAB_REPORT_GENERATED: 'hospital.lab.report-generated',
  PRESCRIPTION_CREATED: 'hospital.prescription.created',
  BILLING_GENERATED: 'hospital.billing.generated',
  PAYMENT_COMPLETED: 'hospital.payment.completed',
  PAYMENT_FAILED: 'hospital.payment.failed',
  MEDICINE_DISPENSED: 'hospital.medicine.dispensed',
  NOTIFICATION_REQUESTED: 'hospital.notification.requested',
});
export const ALL_TOPICS = Object.values(TOPICS);
export const dlt = (topic) => `${topic}.DLT`;

export const DEFAULT_PORTS = Object.freeze({
  // App ports sit BELOW the kernel's ephemeral range (32768-60999): a port inside that range can be taken at random by any outgoing
  // connection at the moment a service tries to bind it (observed with 38204). Kafka/Redis stay at 39092/36379 - docker holds them permanently.
  gateway: 30080,
  patient: 30101, doctor: 30102, appointment: 30103, hospital: 30104, 'medical-records': 30105,
  prescription: 30106, laboratory: 30107, billing: 30108, pharmacy: 30109, notification: 30110,
  grpc: { patient: 30201, doctor: 30202, hospital: 30204 },
  kafka: 39092, redis: 36379,
});
