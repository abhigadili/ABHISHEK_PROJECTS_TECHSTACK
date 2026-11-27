import { Injectable, Injector, computed, inject, runInInjectionContext, untracked, type Signal } from '@angular/core';
import { injectOp } from '../../api/queries/op-query';
import { PermissionService } from '../../core/services/permission.service';

/**
 * Reference data: most DTOs point at other entities by id only, so lists of departments / designations / locations / job grades /
 * projects / customers / leave types / cycles are loaded once (TanStack Query cache) to show names and fill selects.
 */
export type RefKind = 'department' | 'designation' | 'location' | 'jobGrade' | 'businessUnit' | 'organization' | 'project' | 'customer' | 'leaveType' | 'cycle' | 'employee' | 'shift' | 'permission' | 'role';
export interface Option { value: string; label: string }
type Plain = Exclude<RefKind, 'employee'>;

const SRC: Record<Plain, { op: string; query?: Record<string, unknown>; map: (r: any) => Option }> = {
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
const rowsOf = (d: any): any[] => (Array.isArray(d) ? d : d?.content ?? []);

@Injectable({ providedIn: 'root' })
export class RefService {
  private readonly injector = inject(Injector);
  private readonly perm = inject(PermissionService);
  private readonly cache = new Map<Plain, { q: ReturnType<typeof injectOp>; options: Signal<Option[]> }>();
  private entry(kind: Plain) {
    let e = this.cache.get(kind);
    if (!e) {
      // creating a query registers effects - never allowed inside a reactive context (callers are often computed())
      e = untracked(() => runInInjectionContext(this.injector, () => {
        const s = SRC[kind];
        const q = injectOp<any>(s.op, () => ({ query: s.query }), () => ({ staleTime: 5 * 60_000, enabled: this.perm.canCall(s.op) }));
        return { q, options: computed(() => rowsOf(q.data()).map(s.map).filter((o: Option) => o.value)) };
      }));
      this.cache.set(kind, e);
    }
    return e;
  }
  options(kind: RefKind): Signal<Option[]> { return this.entry((kind === 'employee' ? 'department' : kind) as Plain).options; }
  loading(kind: RefKind) { return this.entry((kind === 'employee' ? 'department' : kind) as Plain).q.isLoading; }
  /** id -> display name ('—' for empty, short id when unknown) */
  label(kind: RefKind, id?: string | null): string { if (!id) return '—'; const o = this.options(kind)().find((x) => x.value === id); return o ? o.label : `${id.slice(0, 8)}…`; }
}
