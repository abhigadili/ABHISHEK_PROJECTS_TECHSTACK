import type { HHmm, ISODate } from './common';

export type DayOfWeek = 'SUNDAY' | 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY';
export const DAYS_OF_WEEK: readonly DayOfWeek[] = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'] as const;

export interface Doctor {
  id: number;
  userId: number | null;
  fullName: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  licenseNumber: string;
  specialization: string;
  qualification: string | null;
  experienceYears: number | null;
  consultationFee: number;
  hospitalId: number;
  departmentId: number | null;
  active: boolean;
}

export interface DoctorInput {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  licenseNumber: string;
  specialization: string;
  qualification?: string | null;
  experienceYears?: number | null;
  consultationFee: number;
  hospitalId: number;
  departmentId?: number | null;
  userId?: number | null;
}

export interface DoctorListParams {
  specialization?: string;
  hospitalId?: number;
  departmentId?: number;
  active?: boolean;
  page?: number;
  size?: number;
}

export interface ScheduleDay {
  dayOfWeek: DayOfWeek;
  startTime: HHmm;
  endTime: HHmm;
  slotMinutes: number;
  breakStart?: HHmm | null;
  breakEnd?: HHmm | null;
}

export interface Slot {
  startTime: HHmm;
  endTime: HHmm;
  available: boolean;
}

export interface Unavailability {
  id: number;
  date: ISODate;
  reason: string | null;
}

export interface AvailableDoctor {
  doctor: Doctor;
  slotCount: number;
  firstSlot: HHmm | null;
  lastSlotEnd: HHmm | null;
}
