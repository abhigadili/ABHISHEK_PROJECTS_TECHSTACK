import { IdName } from './employee.models';

export interface OrgNode {
  id: number;
  employeeCode: string;
  name: string;
  workEmail: string;
  designation: string | null;
  jobTitle: string | null;
  department: IdName | null;
  managerId: number | null;
  profilePictureUrl: string | null;
  directReportCount: number;
  subordinates: OrgNode[];
}

export interface OrgChart {
  roots: OrgNode[];
  totalNodes: number;
  warnings?: { unreachableEmployees: { id: number; employeeCode: string; managerId: number | null }[]; reason: string };
}

export type OrgPerson = Omit<OrgNode, 'subordinates' | 'directReportCount'>;

export interface ReportingChain {
  employee: OrgPerson;
  chain: (OrgPerson & { level: number })[];
}

export interface OrgSearchHit extends OrgPerson {
  depth: number;
  managerChainIds: number[];
}

export interface Department {
  id: number;
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
  headEmployeeId: number | null;
  headName: string | null;
  headcount: number;
  createdAt: string;
  updatedAt: string;
}

export interface DepartmentWriteRequest {
  code?: string;
  name?: string;
  description?: string | null;
  headEmployeeId?: number | null;
}

export interface Team {
  id: number;
  departmentId: number;
  departmentName?: string;
  name: string;
  description: string | null;
  leadEmployeeId: number | null;
  leadName?: string | null;
  isActive: boolean;
  memberCount?: number;
}

export interface Designation {
  id: number;
  name: string;
  description: string | null;
  jobLevel: number | null;
  isActive: boolean;
  headcount: number;
}

export interface DesignationWriteRequest {
  name?: string;
  description?: string | null;
  jobLevel?: number | null;
  isActive?: boolean;
}
