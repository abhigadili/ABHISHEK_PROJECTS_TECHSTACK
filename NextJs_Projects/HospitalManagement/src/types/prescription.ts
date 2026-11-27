import type { ISODate, ISODateTime } from './common';

export type PrescriptionStatus = 'ACTIVE' | 'DISPENSED' | 'CANCELLED' | 'EXPIRED';

export interface PrescriptionItem {
  id: number;
  medicineName: string;
  dosage: string;
  frequency: string;
  durationDays: number;
  quantity: number;
  instructions: string | null;
}

export interface Prescription {
  id: number;
  patientId: number;
  patientName: string;
  doctorId: number;
  doctorName: string;
  appointmentId: number | null;
  diagnosis: string | null;
  notes: string | null;
  status: PrescriptionStatus;
  validUntil: ISODate;
  issuedAt: ISODateTime;
  items: PrescriptionItem[];
}

export interface PrescriptionItemInput {
  medicineName: string;
  dosage: string;
  frequency: string;
  durationDays: number;
  quantity: number;
  instructions?: string | null;
}

export interface PrescriptionInput {
  patientId: number;
  doctorId: number;
  appointmentId?: number | null;
  diagnosis?: string | null;
  notes?: string | null;
  validDays: number;
  items: PrescriptionItemInput[];
}

export interface PrescriptionStatusResponse {
  id: number;
  status: PrescriptionStatus;
  statusChangedAt: ISODateTime;
}
