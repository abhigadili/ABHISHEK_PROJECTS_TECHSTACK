import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { Employee, EMPLOYMENT_TYPES, EMPLOYEE_STATUSES, EmployeeStatus, EmploymentType } from '../../core/models/employee.models';
import { EmployeeService } from '../../core/services/employee.service';
import { PermissionService } from '../../core/services/permission.service';
import { ReferenceDataService } from '../../core/services/reference-data.service';
import { ToastService } from '../../core/services/toast.service';
import { DataTableComponent, CellDirective, TableColumn } from '../../shared/components/data-table.component';
import { DialogService } from '../../shared/components/dialogs';
import { EmployeeCardComponent } from '../../shared/components/employee-card.component';
import { PaginationComponent } from '../../shared/components/pagination.component';
import { ProfilePictureComponent } from '../../shared/components/profile-picture.component';
import { SearchBoxComponent } from '../../shared/components/search-box.component';
import { ErrorMessageComponent, PageHeaderComponent, StatusBadgeComponent } from '../../shared/components/ui-basics';
import { HasPermissionDirective } from '../../shared/directives/directives';
import { EmployeeStatusPipe, EmploymentTypePipe } from '../../shared/pipes/pipes';
import { toCsv } from '../../shared/utils/csv';
import { downloadBlob } from '../../shared/utils/download';
import { firstValueFrom, lastValueFrom, mergeMap, range, toArray } from 'rxjs';
import { EmployeeListStore } from './employee-list.store';

const SORTABLE = new Set(['name', 'employeeCode', 'joiningDate', 'department', 'designation', 'status']);

/**
 * Employee directory. The URL is the source of truth for filters, sort and pagination (shareable, back-button friendly):
 *   ActivatedRoute.queryParamMap ─▶ store.applyParams ─▶ HTTP ─▶ table
 *   user actions ─▶ router.navigate({ queryParams, queryParamsHandling: 'merge' })
 */
@Component({
  selector: 'app-employee-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [EmployeeListStore], // component-level provider: one isolated store per list instance
  imports: [
    RouterLink, DatePipe, MatButtonModule, MatFormFieldModule, MatIconModule, MatSelectModule, MatTooltipModule, MatButtonToggleModule,
    DataTableComponent, CellDirective, SearchBoxComponent, PaginationComponent, EmployeeCardComponent, ProfilePictureComponent,
    StatusBadgeComponent, PageHeaderComponent, ErrorMessageComponent, HasPermissionDirective, EmployeeStatusPipe, EmploymentTypePipe,
  ],
  template: `
    <div class="page">
      <app-page-header title="Employees" subtitle="Search, filter and manage the employee directory">
        <button pageActions mat-stroked-button type="button" *appHasPermission="'report.view'" [disabled]="exporting()" (click)="exportCsv()" data-testid="export-employees"><mat-icon>download</mat-icon> Export CSV</button>
        <a pageActions mat-flat-button routerLink="/employees/new" *appHasPermission="'employee.write'" data-testid="new-employee"><mat-icon>person_add</mat-icon> New employee</a>
      </app-page-header>

      <div class="panel">
        <div class="toolbar-row">
          <div class="grow"><app-search-box label="Search employees" placeholder="Name, email, code or job title" [value]="store.criteria().q" (searchChange)="patch({ q: $event })" /></div>
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Department</mat-label>
            <mat-select [value]="store.criteria().departmentId" (selectionChange)="patch({ departmentId: $event.value })" data-testid="filter-department">
              <mat-option [value]="null">All departments</mat-option>
              @for (d of departments(); track d.id) {
                <mat-option [value]="d.id">{{ d.name }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Designation</mat-label>
            <mat-select [value]="store.criteria().designationId" (selectionChange)="patch({ designationId: $event.value })">
              <mat-option [value]="null">All designations</mat-option>
              @for (d of designations(); track d.id) {
                <mat-option [value]="d.id">{{ d.name }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Status</mat-label>
            <mat-select [value]="store.criteria().status" (selectionChange)="patch({ status: $event.value })" data-testid="filter-status">
              <mat-option value="ALL">All</mat-option>
              @for (s of statuses; track s) {
                <mat-option [value]="s">{{ s | employeeStatus }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Type</mat-label>
            <mat-select [value]="store.criteria().employmentType" (selectionChange)="patch({ employmentType: $event.value })">
              <mat-option [value]="null">Any type</mat-option>
              @for (t of types; track t) {
                <mat-option [value]="t">{{ t | employmentType }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
          @if (store.hasActiveFilters()) {
            <button mat-button type="button" (click)="clearFilters()"><mat-icon>filter_alt_off</mat-icon> Clear</button>
          }
          <mat-button-toggle-group [value]="view()" (change)="view.set($event.value)" aria-label="View mode" class="view-toggle">
            <mat-button-toggle value="table" aria-label="Table view"><mat-icon>table_rows</mat-icon></mat-button-toggle>
            <mat-button-toggle value="cards" aria-label="Card view"><mat-icon>grid_view</mat-icon></mat-button-toggle>
          </mat-button-toggle-group>
        </div>

        <app-error-message [error]="store.error()" (retry)="reload()" />

        @if (view() === 'table') {
          <app-data-table
            testId="employee-table"
            [columns]="columns" [rows]="store.items()" [meta]="store.meta()" [clickable]="true"
            [sortActive]="sort().active" [sortDirection]="sort().direction"
            emptyIcon="groups" emptyTitle="No employees match" emptyMessage="Try changing the search text or clearing the filters."
            (sortChange)="onSort($event)" (pageChange)="onPage($event)" (rowClick)="open($event)"
          >
            <ng-template appCell="name" let-e>
              <div class="name-cell">
                <app-profile-picture [employeeId]="e.id" [hasPicture]="!!e.profilePictureUrl" [name]="e.fullName" [size]="32" />
                <div><a [routerLink]="['/employees', e.id]" (click)="$event.stopPropagation()" class="name">{{ e.fullName }}</a><div class="muted">{{ e.workEmail }}</div></div>
              </div>
            </ng-template>
            <ng-template appCell="designation" let-e>{{ e.designation?.name ?? e.jobTitle ?? '—' }}</ng-template>
            <ng-template appCell="department" let-e>{{ e.department?.name ?? '—' }}</ng-template>
            <ng-template appCell="status" let-e><app-status-badge [value]="e.status" [label]="e.status | employeeStatus" /></ng-template>
            <ng-template appCell="joiningDate" let-e>{{ e.joiningDate | date: 'mediumDate' }}</ng-template>
            <ng-template appCell="actions" let-e>
              <div class="row-actions" (click)="$event.stopPropagation()" (keydown.enter)="$event.stopPropagation()">
                <a mat-icon-button [routerLink]="['/employees', e.id]" matTooltip="View details" aria-label="View details"><mat-icon>visibility</mat-icon></a>
                <ng-container *appHasPermission="'employee.write'">
                  <a mat-icon-button [routerLink]="['/employees', e.id, 'edit']" matTooltip="Edit" aria-label="Edit employee"><mat-icon>edit</mat-icon></a>
                  @if (e.status === 'ACTIVE') {
                    <button mat-icon-button type="button" matTooltip="Deactivate" aria-label="Deactivate employee" (click)="deactivate(e)"><mat-icon>person_off</mat-icon></button>
                  } @else {
                    <button mat-icon-button type="button" matTooltip="Reactivate" aria-label="Reactivate employee" (click)="reactivate(e)"><mat-icon>person_check</mat-icon></button>
                  }
                </ng-container>
              </div>
            </ng-template>
          </app-data-table>
        } @else {
          <div class="card-grid">
            @for (e of store.items(); track e.id) {
              <app-employee-card [employee]="e" (selected)="open($event)" />
            } @empty {
              @if (!store.loading()) {
                <p class="muted">No employees match your filters.</p>
              }
            }
          </div>
          @if (store.meta(); as m) {
            <app-pagination [meta]="m" (pageChange)="onPage($event)" />
          }
        }
      </div>
    </div>
  `,
  styles: `
    .grow { flex: 1 1 260px; }
    .name-cell { display: flex; align-items: center; gap: 12px; padding: 6px 0; }
    .name { font-weight: 500; text-decoration: none; }
    .view-toggle { margin-left: auto; }
  `,
})
export class EmployeeListComponent {
  protected readonly store = inject(EmployeeListStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly employees = inject(EmployeeService);
  private readonly dialogs = inject(DialogService);
  private readonly toast = inject(ToastService);
  private readonly permissions = inject(PermissionService);
  private readonly reference = inject(ReferenceDataService);

  protected readonly statuses = EMPLOYEE_STATUSES;
  protected readonly types = EMPLOYMENT_TYPES;
  protected readonly departments = toSignal(this.reference.departments(), { initialValue: [] });
  protected readonly designations = toSignal(this.reference.designations(), { initialValue: [] });
  protected readonly view = signal<'table' | 'cards'>('table');

  protected readonly columns: TableColumn[] = [
    { key: 'name', label: 'Employee', sortable: true },
    { key: 'employeeCode', label: 'Code', sortable: true },
    { key: 'department', label: 'Department', sortable: true },
    { key: 'designation', label: 'Designation', sortable: true },
    { key: 'status', label: 'Status', sortable: true },
    { key: 'joiningDate', label: 'Joined', sortable: true },
    { key: 'actions', label: '', align: 'end' },
  ];

  /** Parsed `sort=field:dir` for the table header arrows. */
  protected readonly sort = () => {
    const [active = 'name', dir = 'asc'] = this.store.criteria().sort.split(':');
    return { active, direction: (dir === 'desc' ? 'desc' : 'asc') as 'asc' | 'desc' };
  };

  constructor() {
    // URL → store. paramMap/queryParamMap are Observables: they emit again on every navigation that only changes query params.
    this.route.queryParamMap
      .pipe(takeUntilDestroyed(inject(DestroyRef)))
      .subscribe((q) => {
        const num = (k: string) => (q.get(k) && !isNaN(+q.get(k)!) ? +q.get(k)! : null);
        const status = q.get('status');
        const sort = q.get('sort') ?? 'name:asc';
        this.store.applyParams({
          q: q.get('q') ?? '',
          departmentId: num('departmentId'),
          designationId: num('designationId'),
          status: (EMPLOYEE_STATUSES as readonly string[]).includes(status ?? '') || status === 'ALL' ? (status as EmployeeStatus | 'ALL') : 'ACTIVE',
          employmentType: (EMPLOYMENT_TYPES as readonly string[]).includes(q.get('employmentType') ?? '') ? (q.get('employmentType') as EmploymentType) : null,
          sort: SORTABLE.has(sort.split(':')[0]) ? sort : 'name:asc',
          limit: num('limit') ?? 10,
          page: num('page') ?? 1,
        });
      });
  }

  /** store → URL: merges only what changed and resets paging, keeping other params. */
  protected patch(p: Record<string, string | number | null>): void {
    void this.router.navigate([], { relativeTo: this.route, queryParams: { page: null, ...p }, queryParamsHandling: 'merge' });
  }

  protected clearFilters(): void {
    void this.router.navigate([], { relativeTo: this.route, queryParams: { q: null, departmentId: null, designationId: null, status: null, employmentType: null, page: null } , queryParamsHandling: 'merge' });
  }

  protected onSort(e: { active: string; direction: 'asc' | 'desc' | '' }): void {
    this.patch({ sort: e.direction ? `${e.active}:${e.direction}` : null });
  }

  protected onPage(e: { page: number; limit: number }): void {
    void this.router.navigate([], { relativeTo: this.route, queryParams: { page: e.page, limit: e.limit }, queryParamsHandling: 'merge' });
  }

  protected open(e: Employee): void {
    // Programmatic navigation carrying navigation state (read back with history.state / getCurrentNavigation) — used by the details page "Back" link.
    void this.router.navigate(['/employees', e.id], { state: { from: this.router.url } });
  }

  protected readonly exporting = signal(false);

  /**
   * The backend has no employee CSV endpoint, so the export is assembled client-side from the SAME filtered list API:
   * page 1 tells us how many pages exist, the rest are fetched 3 at a time with mergeMap (bounded concurrency).
   */
  protected async exportCsv(): Promise<void> {
    this.exporting.set(true);
    try {
      const base = { ...this.store.criteria(), page: 1, limit: 100 };
      const first = await firstValueFrom(this.employees.list(base));
      const rest =
        first.meta.totalPages > 1
          ? await lastValueFrom(range(2, first.meta.totalPages - 1).pipe(mergeMap((page) => this.employees.list({ ...base, page }), 3), toArray()))
          : [];
      const all = [first, ...rest].flatMap((p) => p.items).sort((a, b) => a.id - b.id);
      const csv = toCsv(all, [
        { header: 'Code', value: (e) => e.employeeCode },
        { header: 'Name', value: (e) => e.fullName },
        { header: 'Work email', value: (e) => e.workEmail },
        { header: 'Department', value: (e) => e.department?.name },
        { header: 'Designation', value: (e) => e.designation?.name ?? e.jobTitle },
        { header: 'Status', value: (e) => e.status },
        { header: 'Employment type', value: (e) => e.employmentType },
        { header: 'Joined', value: (e) => e.joiningDate },
      ]);
      downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), 'employees.csv');
      this.toast.success(`Exported ${all.length} employees`);
    } finally {
      this.exporting.set(false);
    }
  }

  protected reload(): void {
    const page = this.store.page();
    this.store.criteria.update((c) => ({ ...c })); // new object ⇒ re-query (and linkedSignal resets page…)
    this.store.page.set(page); // …so restore the page the user was on
  }

  protected deactivate(e: Employee): void {
    if (!this.permissions.has('employee.write')) return;
    this.dialogs
      .askReason({ title: `Deactivate ${e.fullName}?`, message: 'The employee loses access immediately. Direct reports must be reassigned by the backend rules.', label: 'Reason (optional)', required: false, confirmLabel: 'Deactivate', danger: true })
      .subscribe((reason) => {
        this.employees.deactivate(e.id, { reason: reason || undefined }).subscribe(() => {
          this.toast.success(`${e.fullName} deactivated`);
          this.reload();
        });
      });
  }

  protected reactivate(e: Employee): void {
    this.employees.reactivate(e.id).subscribe(() => {
      this.toast.success(`${e.fullName} reactivated`);
      this.reload();
    });
  }
}
