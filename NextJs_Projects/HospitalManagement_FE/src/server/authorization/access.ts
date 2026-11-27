import 'server-only';
import { db } from '@/server/db';
import { forbidden, notFound } from '@/server/utilities/errors';
import { audit } from '@/server/services/audit.service';
import type { Principal } from './principal';

/**
 * RESOURCE-level authorization (beyond "does the role have the permission"):
 *  - a PATIENT sees only their own data;
 *  - a DOCTOR sees clinical data only of patients they treat (an appointment, record, prescription or lab request links them);
 *  - hospital-scoped staff only touch operational data of THEIR hospital;
 *  - SUPER_ADMIN may read clinical data but every such read is written to the audit log (break-glass).
 */
export async function doctorTreatsPatient(doctorId: number, patientId: number): Promise<boolean> {
  const [a, r, rx] = await Promise.all([
    db.appointment.count({ where: { doctorId, patientId, status: { not: 'CANCELLED' } } }),
    db.medicalRecord.count({ where: { doctorId, patientId } }),
    db.prescription.count({ where: { doctorId, patientId } }),
  ]);
  return a + r + rx > 0;
}

/** Clinical data (medical records, prescriptions, lab reports). */
export async function assertClinicalAccess(p: Principal, patientId: number): Promise<void> {
  if (p.role === 'PATIENT') { if (p.patientId !== patientId) throw forbidden('You can only access your own records'); return; }
  if (p.role === 'DOCTOR') { if (!p.doctorId || !(await doctorTreatsPatient(p.doctorId, patientId))) throw forbidden('This patient is not under your care'); return; }
  if (p.role === 'SUPER_ADMIN') { await audit(p, 'CLINICAL_ACCESS', 'Patient', patientId); return; }
  throw forbidden();
}
/** Demographic data: patient (own), doctors treating, any staff holding patient:read (checked by the caller). */
export async function assertPatientDemographicsAccess(p: Principal, patientId: number): Promise<void> {
  if (p.role === 'PATIENT') { if (p.patientId !== patientId) throw forbidden(); return; }
  if (p.role === 'DOCTOR') { if (!p.doctorId || !(await doctorTreatsPatient(p.doctorId, patientId))) throw forbidden('This patient is not under your care'); }
}
export function assertHospitalScope(p: Principal, hospitalId: number): void {
  if (p.role === 'SUPER_ADMIN') return;
  if (p.hospitalId !== null && p.hospitalId !== hospitalId) throw forbidden('This resource belongs to another hospital');
}
/** Scope filter to merge into queries: SUPER_ADMIN/PATIENT/DOCTOR unrestricted here (other rules apply), hospital staff restricted. */
export const hospitalFilter = (p: Principal): { hospitalId?: number } => (p.role !== 'SUPER_ADMIN' && p.hospitalId !== null ? { hospitalId: p.hospitalId } : {});
export async function requirePatient(id: number) { const x = await db.patient.findFirst({ where: { id, deletedAt: null }, include: { user: true } }); if (!x) throw notFound('Patient'); return x; }
