import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { TOPICS } from '../constants/index.js';

/**
 * Event contracts: strongly structured payloads, independent of every service's database entities.
 * Producers build events with buildEvent() (payload validated), consumers re-validate with parseEvent().
 */
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const time = z.string().regex(/^\d{2}:\d{2}$/);
const email = z.string().nullable().optional();
const patientRef = { patientId: z.number().int(), patientName: z.string(), patientEmail: email };

export const EVENTS = {
  PatientRegistered: { topic: TOPICS.PATIENT_REGISTERED, schema: z.object({ patientId: z.number().int(), userId: z.number().int().nullable(), firstName: z.string(), lastName: z.string(), email: z.string(), phone: z.string() }) },
  AppointmentBooked: { topic: TOPICS.APPOINTMENT_BOOKED, schema: z.object({ appointmentId: z.number().int(), ...patientRef, doctorId: z.number().int(), doctorName: z.string(), doctorEmail: email, date, startTime: time, endTime: time, fee: z.number() }) },
  AppointmentCancelled: { topic: TOPICS.APPOINTMENT_CANCELLED, schema: z.object({ appointmentId: z.number().int(), ...patientRef, doctorId: z.number().int(), doctorName: z.string(), doctorEmail: email, date, startTime: time, cancelledBy: z.string(), reason: z.string().nullable().optional() }) },
  AppointmentRescheduled: { topic: TOPICS.APPOINTMENT_RESCHEDULED, schema: z.object({ appointmentId: z.number().int(), ...patientRef, doctorId: z.number().int(), doctorName: z.string(), doctorEmail: email, oldDate: date, oldStartTime: time, newDate: date, newStartTime: time, newEndTime: time }) },
  AppointmentCompleted: { topic: TOPICS.APPOINTMENT_COMPLETED, schema: z.object({ appointmentId: z.number().int(), patientId: z.number().int(), doctorId: z.number().int(), doctorName: z.string(), date, notes: z.string().nullable().optional() }) },
  LabTestRequested: { topic: TOPICS.LAB_TEST_REQUESTED, schema: z.object({ requestId: z.number().int(), ...patientRef, doctorId: z.number().int(), testCode: z.string(), testName: z.string(), price: z.number(), priority: z.string() }) },
  LabReportGenerated: { topic: TOPICS.LAB_REPORT_GENERATED, schema: z.object({ reportId: z.number().int(), requestId: z.number().int(), ...patientRef, doctorId: z.number().int(), testName: z.string(), summary: z.string(), abnormal: z.boolean() }) },
  PrescriptionCreated: {
    topic: TOPICS.PRESCRIPTION_CREATED,
    schema: z.object({ prescriptionId: z.number().int(), ...patientRef, doctorId: z.number().int(), doctorName: z.string(), validUntil: date, diagnosis: z.string().nullable().optional(),
      items: z.array(z.object({ medicineName: z.string(), dosage: z.string(), frequency: z.string(), durationDays: z.number().int(), quantity: z.number().int() })) }),
  },
  BillingGenerated: { topic: TOPICS.BILLING_GENERATED, schema: z.object({ billId: z.number().int(), billNumber: z.string(), ...patientRef, billType: z.string(), referenceType: z.string().nullable().optional(), referenceId: z.number().int().nullable().optional(), amount: z.number(), dueDate: date }) },
  PaymentCompleted: { topic: TOPICS.PAYMENT_COMPLETED, schema: z.object({ billId: z.number().int(), billNumber: z.string(), transactionRef: z.string(), ...patientRef, referenceType: z.string().nullable().optional(), referenceId: z.number().int().nullable().optional(), amount: z.number() }) },
  PaymentFailed: { topic: TOPICS.PAYMENT_FAILED, schema: z.object({ billId: z.number().int(), billNumber: z.string(), transactionRef: z.string(), ...patientRef, referenceType: z.string().nullable().optional(), referenceId: z.number().int().nullable().optional(), amount: z.number(), reason: z.string() }) },
  MedicineDispensed: { topic: TOPICS.MEDICINE_DISPENSED, schema: z.object({ orderId: z.number().int(), prescriptionId: z.number().int(), ...patientRef, totalAmount: z.number(), items: z.array(z.object({ medicineName: z.string(), quantity: z.number().int(), unitPrice: z.number() })) }) },
  NotificationRequested: { topic: TOPICS.NOTIFICATION_REQUESTED, schema: z.object({ recipientEmail: z.string(), recipientPhone: z.string().nullable().optional(), channel: z.enum(['EMAIL', 'SMS']), subject: z.string(), message: z.string(), eventType: z.string(), referenceId: z.string().nullable().optional() }) },
};

const envelopeSchema = z.object({ eventId: z.string(), type: z.string(), occurredAt: z.string(), correlationId: z.string().nullable().optional(), payload: z.unknown() });

/** Builds a validated envelope { eventId, type, occurredAt, correlationId, payload } for the outbox. */
export function buildEvent(type, payload, correlationId) {
  const def = EVENTS[type];
  if (!def) throw new Error(`Unknown event type ${type}`);
  return { topic: def.topic, event: { eventId: randomUUID(), type, occurredAt: new Date().toISOString(), correlationId: correlationId ?? null, payload: def.schema.parse(payload) } };
}

/** Parses + validates a received message; throws (poison message) when it does not match the contract. */
export function parseEvent(raw) {
  const env = envelopeSchema.parse(JSON.parse(raw));
  const def = EVENTS[env.type];
  if (!def) throw new Error(`Unknown event type ${env.type}`);
  return { ...env, payload: def.schema.parse(env.payload) };
}
