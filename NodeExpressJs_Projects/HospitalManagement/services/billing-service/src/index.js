import { PrismaClient } from '../generated/client/index.js';
import { startService } from '@hms/shared/bootstrap';
import { DEFAULT_PORTS, TOPICS } from '@hms/shared/constants';
import { createPatientDirectory } from '@hms/shared/clients';
import { createHttpClient } from '@hms/shared/utils';
import { createBillingService } from './service.js';
import { registerRoutes } from './routes.js';

await startService({
  service: 'billing-service', dbName: 'BillingDB', defaultPort: DEFAULT_PORTS.billing, PrismaClient, apiTitle: 'Billing Service',
  build(ctx) {
    const patients = createPatientDirectory(ctx);                                    // gRPC
    const http = createHttpClient({ name: 'appointment-service', baseUrl: ctx.config.services.http.appointment, logger: ctx.logger, timeoutMs: ctx.config.http.timeoutMs });
    const appointments = { get: (id) => http.get(`/api/appointments/${id}`) };       // HTTP + Opossum
    const svc = createBillingService({ ...ctx, patients, appointments });
    const { jobs } = ctx.config;
    return {
      registerRoutes: (api) => registerRoutes(api, svc),
      // Billing reacts to business events - nobody has to call it synchronously
      handlers: {
        [TOPICS.APPOINTMENT_BOOKED]: (e, { tx }) => svc.generateFromEvent(tx, { billType: 'APPOINTMENT', referenceType: 'APPOINTMENT', referenceId: e.appointmentId, patientId: e.patientId, patientName: e.patientName, patientEmail: e.patientEmail, description: `Consultation with ${e.doctorName} on ${e.date} ${e.startTime}`, unitPrice: e.fee }),
        [TOPICS.APPOINTMENT_CANCELLED]: (e, { tx }) => svc.onAppointmentCancelled(tx, e.appointmentId),
        [TOPICS.LAB_TEST_REQUESTED]: (e, { tx }) => svc.generateFromEvent(tx, { billType: 'LAB', referenceType: 'LAB_REQUEST', referenceId: e.requestId, patientId: e.patientId, patientName: e.patientName, patientEmail: e.patientEmail, description: `Lab test: ${e.testName} (${e.testCode})`, unitPrice: e.price }),
        [TOPICS.MEDICINE_DISPENSED]: (e, { tx }) => svc.generateMedicineBill(tx, e),
      },
      jobs: [
        { name: 'pending-payments', schedule: jobs.pendingPaymentsCron, run: () => svc.failStalePayments() },
        { name: 'overdue-and-reminders', schedule: jobs.overdueCron, run: () => svc.overdueAndReminders() },
      ],
    };
  },
});
