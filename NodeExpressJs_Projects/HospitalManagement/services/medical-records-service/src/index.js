import { PrismaClient } from '../generated/client/index.js';
import { startService } from '@hms/shared/bootstrap';
import { DEFAULT_PORTS, TOPICS } from '@hms/shared/constants';
import { createPatientDirectory } from '@hms/shared/clients';
import { createRecordService } from './service.js';
import { registerRoutes } from './routes.js';

await startService({
  service: 'medical-records-service', dbName: 'MedicalRecordsDB', defaultPort: DEFAULT_PORTS['medical-records'], PrismaClient, apiTitle: 'Medical Records Service', outbox: false,
  build(ctx) {
    const svc = createRecordService({ ...ctx, patients: createPatientDirectory(ctx) });
    return {
      registerRoutes: (api) => registerRoutes(api, svc),
      // the clinical timeline is built from events published by the other services
      handlers: {
        [TOPICS.PATIENT_REGISTERED]: (e, { tx }) => svc.initRecord(tx, e.patientId, `${e.firstName} ${e.lastName}`),
        [TOPICS.LAB_REPORT_GENERATED]: (e, { tx }) => svc.addSystemEntry(tx, { patientId: e.patientId, patientName: e.patientName, entryType: 'LAB_REPORT', title: `Lab report: ${e.testName}${e.abnormal ? ' (ABNORMAL)' : ''}`, details: e.summary, doctorId: e.doctorId, referenceType: 'LAB_REPORT', referenceId: e.reportId }),
        [TOPICS.PRESCRIPTION_CREATED]: (e, { tx }) => svc.addSystemEntry(tx, { patientId: e.patientId, patientName: e.patientName, entryType: 'PRESCRIPTION', title: `Prescription #${e.prescriptionId} by ${e.doctorName}`,
          details: [e.diagnosis ? `Diagnosis: ${e.diagnosis}` : null, ...e.items.map((i) => `- ${i.medicineName} ${i.dosage}, ${i.frequency}, ${i.durationDays} days`)].filter(Boolean).join('\n'), doctorId: e.doctorId, referenceType: 'PRESCRIPTION', referenceId: e.prescriptionId }),
        [TOPICS.APPOINTMENT_COMPLETED]: (e, { tx }) => svc.addSystemEntry(tx, { patientId: e.patientId, entryType: 'VISIT', title: `Visit with ${e.doctorName} on ${e.date}`, details: e.notes, doctorId: e.doctorId, referenceType: 'APPOINTMENT', referenceId: e.appointmentId }),
      },
    };
  },
});
