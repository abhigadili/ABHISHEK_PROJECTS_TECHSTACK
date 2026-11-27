import { PrismaClient } from '../generated/client/index.js';
import { startService } from '@hms/shared/bootstrap';
import { DEFAULT_PORTS, TOPICS } from '@hms/shared/constants';
import { createNotificationService } from './service.js';
import { registerRoutes } from './routes.js';

await startService({
  service: 'notification-service', dbName: 'NotificationDB', defaultPort: DEFAULT_PORTS.notification, PrismaClient, apiTitle: 'Notification Service', outbox: false,
  build(ctx) {
    const svc = createNotificationService(ctx);
    const q = (tx, o) => svc.queue(tx, o);
    const h = {
      [TOPICS.PATIENT_REGISTERED]: (e, { tx }) => q(tx, { email: e.email, phone: e.phone, subject: 'Welcome to the hospital', message: `Hello ${e.firstName} ${e.lastName}, your patient registration is complete. Your patient id is ${e.patientId}.`, eventType: 'PATIENT_REGISTERED', referenceId: String(e.patientId) }),
      [TOPICS.APPOINTMENT_BOOKED]: async (e, { tx }) => {
        await q(tx, { email: e.patientEmail, subject: 'Appointment confirmed', message: `Your appointment with ${e.doctorName} is confirmed for ${e.date} ${e.startTime}-${e.endTime}. Consultation fee: ${e.fee}.`, eventType: 'APPOINTMENT_BOOKED', referenceId: String(e.appointmentId) });
        await q(tx, { email: e.doctorEmail, subject: 'New appointment', message: `New appointment with patient ${e.patientName} on ${e.date} ${e.startTime}-${e.endTime}.`, eventType: 'APPOINTMENT_BOOKED', referenceId: String(e.appointmentId) });
      },
      [TOPICS.APPOINTMENT_CANCELLED]: async (e, { tx }) => {
        const why = e.reason ? ` Reason: ${e.reason}.` : '';
        await q(tx, { email: e.patientEmail, subject: 'Appointment cancelled', message: `Your appointment with ${e.doctorName} on ${e.date} ${e.startTime} was cancelled by ${e.cancelledBy}.${why}`, eventType: 'APPOINTMENT_CANCELLED', referenceId: String(e.appointmentId) });
        await q(tx, { email: e.doctorEmail, subject: 'Appointment cancelled', message: `The appointment with ${e.patientName} on ${e.date} ${e.startTime} was cancelled.${why}`, eventType: 'APPOINTMENT_CANCELLED', referenceId: String(e.appointmentId) });
      },
      [TOPICS.APPOINTMENT_RESCHEDULED]: async (e, { tx }) => {
        const m = `moved from ${e.oldDate} ${e.oldStartTime} to ${e.newDate} ${e.newStartTime}-${e.newEndTime}`;
        await q(tx, { email: e.patientEmail, subject: 'Appointment rescheduled', message: `Your appointment with ${e.doctorName} was ${m}.`, eventType: 'APPOINTMENT_RESCHEDULED', referenceId: String(e.appointmentId) });
        await q(tx, { email: e.doctorEmail, subject: 'Appointment rescheduled', message: `Appointment with ${e.patientName} was ${m}.`, eventType: 'APPOINTMENT_RESCHEDULED', referenceId: String(e.appointmentId) });
      },
      [TOPICS.LAB_REPORT_GENERATED]: (e, { tx }) => q(tx, { email: e.patientEmail, subject: 'Lab report ready', message: `Your report for '${e.testName}' is ready${e.abnormal ? ' (please consult your doctor: results flagged abnormal)' : ''}.`, eventType: 'LAB_REPORT_GENERATED', referenceId: String(e.reportId) }),
      [TOPICS.PRESCRIPTION_CREATED]: (e, { tx }) => q(tx, { email: e.patientEmail, subject: 'New prescription', message: `${e.doctorName} issued prescription #${e.prescriptionId} with ${e.items.length} medicine(s), valid until ${e.validUntil}.`, eventType: 'PRESCRIPTION_CREATED', referenceId: String(e.prescriptionId) }),
      [TOPICS.BILLING_GENERATED]: (e, { tx }) => q(tx, { email: e.patientEmail, subject: `New bill ${e.billNumber}`, message: `A bill of ${e.amount} (${e.billType}) has been generated, due ${e.dueDate}.`, eventType: 'BILLING_GENERATED', referenceId: String(e.billId) }),
      [TOPICS.PAYMENT_COMPLETED]: (e, { tx }) => q(tx, { email: e.patientEmail, subject: 'Payment received', message: `We received your payment of ${e.amount} for bill ${e.billNumber} (transaction ${e.transactionRef}). Thank you.`, eventType: 'PAYMENT_COMPLETED', referenceId: e.transactionRef }),
      [TOPICS.PAYMENT_FAILED]: (e, { tx }) => q(tx, { email: e.patientEmail, subject: 'Payment failed', message: `Your payment of ${e.amount} for bill ${e.billNumber} failed: ${e.reason}. You can retry from your bills page.`, eventType: 'PAYMENT_FAILED', referenceId: e.transactionRef }),
      [TOPICS.MEDICINE_DISPENSED]: (e, { tx }) => q(tx, { email: e.patientEmail, subject: 'Medicines dispensed', message: `Your medicines for prescription #${e.prescriptionId} have been dispensed (total ${e.totalAmount}).`, eventType: 'MEDICINE_DISPENSED', referenceId: String(e.orderId) }),
      // reminders / alerts raised by the schedulers of other services
      [TOPICS.NOTIFICATION_REQUESTED]: (e, { tx }) => q(tx, { email: e.recipientEmail, phone: e.recipientPhone, channel: e.channel, subject: e.subject, message: e.message, eventType: e.eventType, referenceId: e.referenceId }),
    };
    return {
      registerRoutes: (api) => registerRoutes(api, svc, ctx),
      handlers: h,
      jobs: [{ name: 'notification-delivery', schedule: ctx.config.jobs.deliveryCron, run: () => svc.deliverPending() }],
    };
  },
});
