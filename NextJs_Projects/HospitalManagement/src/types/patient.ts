import type { ISODate, ISODateTime } from './common';

export type Gender = 'MALE' | 'FEMALE' | 'OTHER';
export type BloodGroup = 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-';
export type PatientStatus = 'ACTIVE' | 'INACTIVE';

export interface Patient {
  id: number;
  userId: number | null;
  firstName: string;
  lastName: string;
  dateOfBirth: ISODate;
  gender: Gender;
  email: string;
  phone: string;
  identityNumber: string | null;
  bloodGroup: BloodGroup | null;
  address: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  knownAllergies: string | null;
  status: PatientStatus;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface PatientInput {
  firstName: string;
  lastName: string;
  dateOfBirth: ISODate;
  gender: Gender;
  email: string;
  phone: string;
  identityNumber?: string | null;
  bloodGroup?: BloodGroup | null;
  address?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  knownAllergies?: string | null;
}

export interface PatientListParams {
  q?: string;
  page?: number;
  size?: number;
}
