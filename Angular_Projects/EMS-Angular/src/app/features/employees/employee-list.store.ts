import { Injectable, computed, inject, linkedSignal, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { catchError, map, of, startWith, switchMap } from 'rxjs';
import { AppError, PageMeta } from '../../core/models/api.models';
import { Employee, EmployeeListFilters, EmployeeStatus, EmploymentType } from '../../core/models/employee.models';
import { DEFAULT_EMPLOYEE_FILTERS, EmployeeService } from '../../core/services/employee.service';

export type Criteria = Omit<EmployeeListFilters, 'page'>;

export type ListState =
  | { status: 'loading'; items: Employee[]; meta: PageMeta | null }
  | { status: 'ready'; items: Employee[]; meta: PageMeta }
  | { status: 'error'; items: Employee[]; meta: PageMeta | null; error: AppError };

const { page: _p, ...DEFAULT_CRITERIA } = DEFAULT_EMPLOYEE_FILTERS;

/**
 * Feature-level state for the employee list — provided in the component's `providers`, so every visit gets a fresh,
 * isolated instance (hierarchical DI), unlike the root singletons.
 *
 * Data flow:  URL query params ──▶ criteria/page signals ──▶ query (computed) ──▶ toObservable ─switchMap▶ HTTP ──▶ toSignal
 * switchMap cancels the in-flight request when filters change; `selectedId` is a linkedSignal that resets whenever the
 * result set no longer contains the selected employee.
 */
@Injectable()
export class EmployeeListStore {
  private readonly api = inject(EmployeeService);

  readonly criteria = signal<Criteria>({ ...DEFAULT_CRITERIA });
  /** linkedSignal: any criteria change resets the page to 1, but the page can still be set explicitly afterwards. */
  readonly page = linkedSignal<Criteria, number>({ source: this.criteria, computation: () => 1 });

  readonly query = computed<EmployeeListFilters>(() => ({ ...this.criteria(), page: this.page() }));

  readonly state = toSignal(
    toObservable(this.query).pipe(
      switchMap((q) =>
        this.api.list(q).pipe(
          map((p): ListState => ({ status: 'ready', items: p.items, meta: p.meta })),
          catchError((error: AppError) => of<ListState>({ status: 'error', items: [], meta: null, error })),
          startWith<ListState>({ status: 'loading', items: [], meta: null }),
        ),
      ),
    ),
    { initialValue: { status: 'loading', items: [], meta: null } as ListState },
  );

  readonly items = computed(() => this.state().items);
  readonly loading = computed(() => this.state().status === 'loading');
  readonly meta = computed(() => this.state().meta);
  readonly error = computed(() => {
    const s = this.state();
    return s.status === 'error' ? s.error : null;
  });

  readonly selectedId = linkedSignal<Employee[], number | null>({
    source: this.items,
    computation: (items, previous) => (previous?.value != null && items.some((e) => e.id === previous.value) ? previous.value : null),
  });
  readonly selected = computed(() => this.items().find((e) => e.id === this.selectedId()) ?? null);

  readonly hasActiveFilters = computed(() => {
    const c = this.criteria();
    return !!(c.q || c.departmentId || c.designationId || c.employmentType || c.status !== DEFAULT_CRITERIA.status);
  });

  /** Called by the component when the URL changes. Only touches signals whose value really changed. */
  applyParams(p: {
    q: string; departmentId: number | null; designationId: number | null; status: EmployeeStatus | 'ALL';
    employmentType: EmploymentType | null; sort: string; limit: number; page: number;
  }): void {
    const { page, ...next } = p;
    if (JSON.stringify(next) !== JSON.stringify(this.criteria())) this.criteria.set(next);
    if (page !== this.page()) this.page.set(page);
  }
}
