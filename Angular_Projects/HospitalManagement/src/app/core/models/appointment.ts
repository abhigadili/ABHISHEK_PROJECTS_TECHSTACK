import type { HHmm, ISODate, ISODateTime } from './common';

export type AppointmentStatus = 'BOOKED' | 'COMPLETED' | 'CANCELLED' | 'MISSED' | 'RESCHEDULED';
export type AppointmentPaymentStatus = 'NOT_BILLED' | 'PENDING' | 'PAID' | 'FAILED';

export interface Appointment {
  id: number;
  patientId: number;
  patientName: string;
  doctorId: number;
  doctorName: string;
  date: ISODate;
  startTime: HHmm;
  endTime: HHmm;
  status: AppointmentStatus;
  reason: string | null;
  cancelReason: string | null;
  notes: string | null;
  fee: number;
  paymentStatus: AppointmentPaymentStatus;
  billNumber: string | null;
  createdAt: ISODateTime;
}

export interface BookAppointmentRequest {
  patientId: number;
  doctorId: number;
  date: ISODate;
  startTime: HHmm;
  reason?: string | null;
}

export interface RescheduleRequest {
  date: ISODate;
  startTime: HHmm;
}
