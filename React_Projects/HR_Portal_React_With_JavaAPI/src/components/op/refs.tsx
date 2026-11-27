import { useMemo } from 'react';
import { useOp } from './useOp';

/**
 * Reference data: most DTOs point at other entities by id only, so lists of departments / designations / locations /
 * job grades / projects / customers / leave types / cycles are loaded once (TanStack Query cache) to show names and fill selects.
 */
export type RefKind = 'department' | 'designation' | 'location' | 'jobGrade' | 'businessUnit' | 'organization' | 'project' | 'customer' | 'leaveType' | 'cycle' | 'employee' | 'shift' | 'permission' | 'role';
export interface Option { value: string; label: string }

const SRC: Record<Exclude<RefKind, 'employee'>, { op: string; query?: Record<string, unknown>; map: (r: any) => Option }> = {
  department: { op: 'organization.listDepartments', query: { size: 200 }, map: (r) => ({ value: r.id, label: r.name }) },
  designation: { op: 'organization.listDesignations', query: { size: 200 }, map: (r) => ({ value: r.id, label: r.title }) },
  location: { op: 'organization.listLocations', query: { size: 200 }, map: (r) => ({ value: r.id, label: r.name }) },
  jobGrade: { op: 'organization.listJobGrades', query: { size: 200 }, map: (r) => ({ value: r.id, label: `${r.code} - ${r.name}` }) },
  businessUnit: { op: 'organization.listBusinessUnits', query: { size: 200 }, map: (r) => ({ value: r.id, label: r.name }) },
  organization: { op: 'organization.list', query: { size: 100 }, map: (r) => ({ value: r.id, label: r.name }) },
  project: { op: 'project.list', query: { size: 100 }, map: (r) => ({ value: r.id, label: `${r.code ?? ''} ${r.name}`.trim() }) },
  customer: { op: 'project.listCustomers', query: { size: 100 }, map: (r) => ({ value: r.id, label: r.name }) },
  leaveType: { op: 'leave.types', map: (r) => ({ value: r.id, label: r.name }) },
  cycle: { op: 'performance.cycles', map: (r) => ({ value: r.id, label: r.name }) },
  shift: { op: 'attendance.shifts', map: (r) => ({ value: r.id, label: r.name }) },
  permission: { op: 'auth.permissions', map: (r) => ({ value: r.code, label: r.code }) },
  role: { op: 'auth.rolesRolesAndPermissions', map: (r) => ({ value: r.name, label: r.name }) },
};

/** Which form field names hold which kind of reference (derived from the backend DTO field names). */
export function refKindForField(name: string): RefKind | null {
  if (/(^|[a-z])(employeeId|managerId|approverId|reviewerId|headId)$/i.test(name) || /^(projectManagerId|headEmployeeId|ownerEmployeeId|reportingManagerId|transfereeEmployeeId|conductedBy)$/.test(name)) return 'employee';
  const m: Record<string, RefKind> = { departmentId: 'department', designationId: 'designation', locationId: 'location', jobGradeId: 'jobGrade', businessUnitId: 'businessUnit', organizationId: 'organization', projectId: 'project', customerId: 'customer', leaveTypeId: 'leaveType', cycleId: 'cycle', shiftId: 'shift', parentId: 'department' };
  return m[name] ?? null;
}

export function useRefList(kind: Exclude<RefKind, 'employee'>, enabled = true) {
  const s = SRC[kind];
  return useOp<any>(s.op, { query: s.query }, { staleTime: 5 * 60_000, enabled });
}
export function useRefOptions(kind: RefKind | null, enabled = true): { options: Option[]; isLoading: boolean } {
  const k = (kind && kind !== 'employee' ? kind : 'department') as Exclude<RefKind, 'employee'>;
  const q = useRefList(k, enabled && !!kind && kind !== 'employee');
  const options = useMemo(() => {
    const rows = Array.isArray(q.data) ? q.data : q.data?.content ?? [];
    return rows.map(SRC[k].map).filter((o: Option) => o.value);
  }, [q.data, k]);
  return { options, isLoading: q.isLoading };
}
/** id -> name resolver for a reference kind. */
export function useRefNames(kind: Exclude<RefKind, 'employee'>) {
  const { options } = useRefOptions(kind);
  return useMemo(() => { const m = new Map(options.map((o) => [o.value, o.label])); return (id?: string | null) => (id ? m.get(id) ?? id : '—'); }, [options]);
}
