import { PrismaClient } from '../generated/client/index.js';
import { startService } from '@hms/shared/bootstrap';
import { DEFAULT_PORTS, TOPICS } from '@hms/shared/constants';
import { createDoctorDirectory, createPatientDirectory } from '@hms/shared/clients';
import { createAppointmentService } from './service.js';
import { registerRoutes } from './routes.js';

await startService({
  service: 'appointment-service', dbName: 'AppointmentDB', defaultPort: DEFAULT_PORTS.appointment, PrismaClient, apiTitle: 'Appointment Service',
  build(ctx) {
    const patients = createPatientDirectory(ctx);      // gRPC
    const doctors = createDoctorDirectory(ctx);        // gRPC (profile) + HTTP/Opossum (slot grid)
    const svc = createAppointmentService({ ...ctx, patients, doctors });
    const { jobs } = ctx.config;
    return {
      registerRoutes: (api) => registerRoutes(api, svc),
      // keep paymentStatus / billNumber in sync with Billing - purely event driven
      handlers: {
        [TOPICS.BILLING_GENERATED]: async (e, { tx }) => { if (e.referenceType === 'APPOINTMENT' && e.referenceId) await svc.applyBilling(tx, e.referenceId, e.billNumber, 'PENDING'); },
        [TOPICS.PAYMENT_COMPLETED]: async (e, { tx }) => { if (e.referenceType === 'APPOINTMENT' && e.referenceId) await svc.applyBilling(tx, e.referenceId, e.billNumber, 'PAID'); },
        [TOPICS.PAYMENT_FAILED]: async (e, { tx }) => { if (e.referenceType === 'APPOINTMENT' && e.referenceId) await svc.applyBilling(tx, e.referenceId, e.billNumber, 'FAILED'); },
      },
      jobs: [
        { name: 'appointment-reminders', schedule: jobs.reminderCron, run: () => svc.sendReminders() },
        { name: 'missed-appointments', schedule: jobs.missedCron, run: () => svc.markMissed() },
      ],
    };
  },
});
