import { Role } from './auth.models';

export type EmployeeStatus = 'ACTIVE' | 'INACTIVE' | 'TERMINATED';
export type EmploymentType = 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'INTERN';
export type ChangeType = 'PROMOTION' | 'TRANSFER' | 'MANAGER_CHANGE' | 'JOB_CHANGE' | 'STATUS_CHANGE' | 'PROBATION';

export const EMPLOYEE_STATUSES: readonly EmployeeStatus[] = ['ACTIVE', 'INACTIVE', 'TERMINATED'];
export const EMPLOYMENT_TYPES: readonly EmploymentType[] = ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN'];
export const CHANGE_TYPES: readonly ChangeType[] = ['PROMOTION', 'TRANSFER', 'MANAGER_CHANGE', 'JOB_CHANGE', 'STATUS_CHANGE', 'PROBATION'];

export interface IdName {
  id: number;
  name: string;
}

export interface ManagerRef extends IdName {
  employeeCode: string;
}

export interface Address {
  line: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  postalCode: string | null;
}

export interface EmergencyContact {
  name: string | null;
  phone: string | null;
  relation: string | null;
}

export interface Compensation {
  salary: number | null;
  salaryCurrency: string | null;
  bonusTarget: number | null;
}

/** Directory fields — visible to every authenticated user. Sensitive fields are optional (admin/self only). */
export interface Employee {
  id: number;
  employeeCode: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  fullName: string;
  workEmail: string;
  phone: string | null;
  status: EmployeeStatus;
  employmentType: EmploymentType;
  designation: IdName | null;
  jobTitle: string | null;
  department: IdName | null;
  team: IdName | null;
  manager: ManagerRef | null;
  workLocation: string | null;
  joiningDate: string;
  profilePictureUrl: string | null;
  personalEmail?: string | null;
  dateOfBirth?: string | null;
  address?: Address;
  emergencyContact?: EmergencyContact;
  probationEndDate?: string | null;
  exitDate?: string | null;
  createdAt?: string;
  updatedAt?: string;
  compensation?: Compensation;
  account?: { userId: number; role: Role } | null;
}

export interface EmployeeListFilters {
  q: string;
  departmentId: number | null;
  designationId: number | null;
  status: EmployeeStatus | 'ALL';
  employmentType: EmploymentType | null;
  sort: string;
  page: number;
  limit: number;
}

/** Request body for POST /employees and PUT/PATCH /employees/:id (all optional on update). */
export interface EmployeeWriteRequest {
  employeeCode?: string;
  firstName?: string;
  middleName?: string | null;
  lastName?: string;
  workEmail?: string;
  personalEmail?: string | null;
  phone?: string | null;
  dateOfBirth?: string | null;
  joiningDate?: string;
  probationEndDate?: string | null;
  addressLine?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  postalCode?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  emergencyContactRelation?: string | null;
  employmentType?: EmploymentType;
  designationId?: number | null;
  departmentId?: number | null;
  teamId?: number | null;
  managerId?: number | null;
  jobTitle?: string | null;
  workLocation?: string | null;
  salary?: number | null;
  salaryCurrency?: string | null;
  changeType?: ChangeType;
  effectiveDate?: string | null;
  notes?: string | null;
  account?: { role: Role; password: string };
}

export interface ProfileUpdateRequest {
  personalEmail?: string | null;
  phone?: string | null;
  addressLine?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  postalCode?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  emergencyContactRelation?: string | null;
}

export interface JobHistoryEntry {
  id: number;
  changeType: ChangeType | 'JOINED' | 'EXIT';
  effectiveDate: string;
  notes: string | null;
  createdAt: string;
  fromJobTitle: string | null;
  toJobTitle: string | null;
  fromDesignation: string | null;
  toDesignation: string | null;
  fromDepartment: string | null;
  toDepartment: string | null;
  fromManager: string | null;
  toManager: string | null;
}

export interface DeactivateRequest {
  reason?: string;
  exitDate?: string | null;
  reassignReportsTo?: number | null;
}

/**
 * Education, experience and skills are NOT stored by the existing backend (see docs/backend-api-integration.md §Missing APIs).
 * The forms keep them in this typed shape and persist to browser storage only, clearly labelled in the UI.
 */
export interface EducationRecord {
  institution: string;
  degree: string;
  fieldOfStudy: string;
  startYear: number | null;
  endYear: number | null;
  grade: string;
}

export interface ExperienceRecord {
  company: string;
  role: string;
  startDate: string;
  endDate: string | null;
  currentlyWorking: boolean;
  summary: string;
}

export interface EmployeeExtras {
  education: EducationRecord[];
  experience: ExperienceRecord[];
  skills: string[];
}
