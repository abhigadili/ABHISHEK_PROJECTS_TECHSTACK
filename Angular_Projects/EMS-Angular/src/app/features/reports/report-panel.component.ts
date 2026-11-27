import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { Observable, catchError, debounceTime, filter, map, of, startWith, switchMap, tap } from 'rxjs';
import { AppError, QueryParams } from '../../core/models/api.models';
import { Permission } from '../../core/models/auth.models';
import { AttendanceService } from '../../core/services/attendance.service';
import { ReferenceDataService } from '../../core/services/reference-data.service';
import { ReportService } from '../../core/services/report.service';
import { ToastService } from '../../core/services/toast.service';
import { ClientTableComponent } from '../../shared/components/client-table.component';
import { TableColumn } from '../../shared/components/data-table.component';
import { ErrorMessageComponent } from '../../shared/components/ui-basics';
import { downloadBlob } from '../../shared/utils/download';
import { firstOfMonth, lastOfMonth, todayIso } from '../../shared/utils/dates';
import { dateRange } from '../../shared/validators/validators';

export interface ReportFilters {
  from: string;
  to: string;
  year: number;
  month: number;
  departmentId: number | null;
}

export type FilterKind = 'range' | 'year' | 'month' | 'department';
type Row = Record<string, unknown>;

export interface ReportDef {
  id: string;
  label: string;
  description: string;
  filters: FilterKind[];
  permission?: Permission;
  columns: TableColumn[];
  load: (f: ReportFilters) => Observable<Row[]>;
  /** Backend CSV endpoint (same path as the JSON report + `format=csv`). */
  csv: { path: string; params: (f: ReportFilters) => QueryParams; filename: string };
}

/** Builds the report catalogue from the real report endpoints. Call inside an injection context. */
export function reportDefinitions(): ReportDef[] {
  const reports = inject(ReportService);
  const attendance = inject(AttendanceService);
  const dep = (f: ReportFilters) => f.departmentId ?? undefined;
  return [
    {
      id: 'headcount', label: 'Headcount by department', description: 'Active and inactive employees per department (HR)', filters: [], permission: 'report.admin',
      columns: [{ key: 'code', label: 'Code' }, { key: 'name', label: 'Department' }, { key: 'head', label: 'Head' }, { key: 'activeEmployees', label: 'Active', align: 'end' }, { key: 'inactiveEmployees', label: 'Inactive', align: 'end' }, { key: 'teams', label: 'Teams', align: 'end' }],
      load: () => reports.departments().pipe(map((r) => r as unknown as Row[])),
      csv: { path: '/reports/departments', params: () => ({}), filename: 'headcount-by-department.csv' },
    },
    {
      id: 'designations', label: 'Designations', description: 'Headcount per designation and level (HR)', filters: [], permission: 'report.admin',
      columns: [{ key: 'name', label: 'Designation' }, { key: 'jobLevel', label: 'Level' }, { key: 'activeEmployees', label: 'Active employees', align: 'end' }],
      load: () => reports.designations().pipe(map((r) => r as unknown as Row[])),
      csv: { path: '/reports/designations', params: () => ({}), filename: 'designations.csv' },
    },
    {
      id: 'joiners-exits', label: 'Joiners & exits', description: 'Employees who joined or left in a period', filters: ['range'],
      columns: [{ key: 'type', label: 'Type' }, { key: 'employeeCode', label: 'Code' }, { key: 'name', label: 'Name' }, { key: 'department', label: 'Department' }, { key: 'date', label: 'Date' }, { key: 'employmentType', label: 'Employment type' }],
      load: (f) => reports.joinersExits(f.from, f.to).pipe(map((r) => [...r.joiners.map((x) => ({ type: 'JOINER', ...x })), ...r.exits.map((x) => ({ type: 'EXIT', ...x }))] as Row[])),
      csv: { path: '/reports/joiners-exits', params: (f) => ({ from: f.from, to: f.to }), filename: 'joiners-exits.csv' },
    },
    {
      id: 'leave-balances', label: 'Leave balances', description: 'Entitlement, adjustments, usage and availability per employee and leave type', filters: ['year', 'department'],
      columns: [{ key: 'employeeCode', label: 'Code' }, { key: 'name', label: 'Name' }, { key: 'department', label: 'Department' }, { key: 'leaveType', label: 'Type' }, { key: 'entitled', label: 'Entitled', align: 'end' }, { key: 'adjusted', label: 'Adjusted', align: 'end' }, { key: 'used', label: 'Used', align: 'end' }, { key: 'available', label: 'Available', align: 'end' }],
      load: (f) => reports.leaveBalances(f.year, dep(f)).pipe(map((r) => r.rows as unknown as Row[])),
      csv: { path: '/reports/leave-balances', params: (f) => ({ year: f.year, departmentId: dep(f) }), filename: 'leave-balances.csv' },
    },
    {
      id: 'leave-summary', label: 'Leave summary', description: 'Requests and days by department, leave type and status', filters: ['range', 'department'],
      columns: [{ key: 'department', label: 'Department' }, { key: 'leaveType', label: 'Type' }, { key: 'status', label: 'Status' }, { key: 'requests', label: 'Requests', align: 'end' }, { key: 'days', label: 'Days', align: 'end' }],
      load: (f) => reports.leaveSummary(f.from, f.to, dep(f)).pipe(map((r) => r.rows as Row[])),
      csv: { path: '/reports/leave-summary', params: (f) => ({ from: f.from, to: f.to, departmentId: dep(f) }), filename: 'leave-summary.csv' },
    },
    {
      id: 'attendance-monthly', label: 'Monthly attendance', description: 'Per-employee attendance counts and hours for a month', filters: ['month', 'department'],
      columns: [{ key: 'employeeCode', label: 'Code' }, { key: 'employeeName', label: 'Name' }, { key: 'department', label: 'Department' }, { key: 'present', label: 'Present', align: 'end' }, { key: 'halfDay', label: 'Half day', align: 'end' }, { key: 'absent', label: 'Absent', align: 'end' }, { key: 'onLeave', label: 'On leave', align: 'end' }, { key: 'totalHours', label: 'Hours', align: 'end' }],
      load: (f) => attendance.monthlyReport(f.year, f.month, dep(f)).pipe(map((r) => r.rows as unknown as Row[])),
      csv: { path: '/attendance/reports/monthly', params: (f) => ({ year: f.year, month: f.month, departmentId: dep(f) }), filename: 'attendance-monthly.csv' },
    },
    {
      id: 'attendance-department', label: 'Attendance by department', description: 'Department totals for a period (HR)', filters: ['range'], permission: 'report.admin',
      columns: [{ key: 'department', label: 'Department' }, { key: 'headcount', label: 'Headcount', align: 'end' }, { key: 'present', label: 'Present', align: 'end' }, { key: 'halfDay', label: 'Half day', align: 'end' }, { key: 'absent', label: 'Absent', align: 'end' }, { key: 'onLeave', label: 'On leave', align: 'end' }, { key: 'totalHours', label: 'Hours', align: 'end' }],
      load: (f) => attendance.departmentReport(f.from, f.to).pipe(map((r) => r.rows as unknown as Row[])),
      csv: { path: '/attendance/reports/department', params: (f) => ({ from: f.from, to: f.to }), filename: 'attendance-by-department.csv' },
    },
  ];
}

type Load = { rows: Row[]; error: AppError | null; loading: boolean };
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/**
 * One configurable panel renders any ReportDef: filters (typed form with a date-range validator) → debounced,
 * switchMap-cancelled request → searchable/paginated table, plus a backend-generated CSV download.
 */
@Component({
  selector: 'app-report-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule, MatSelectModule, ClientTableComponent, ErrorMessageComponent],
  template: `
    <p class="muted desc">{{ def().description }}</p>
    <form class="toolbar-row" [formGroup]="form" novalidate>
      @if (has('range')) {
        <mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>From</mat-label><input matInput type="date" formControlName="from" [attr.data-testid]="'report-from'" /></mat-form-field>
        <mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>To</mat-label><input matInput type="date" formControlName="to" [attr.data-testid]="'report-to'" /></mat-form-field>
      }
      @if (has('year') || has('month')) {
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Year</mat-label>
          <mat-select formControlName="year">
            @for (y of years; track y) {
              <mat-option [value]="y">{{ y }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
      }
      @if (has('month')) {
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Month</mat-label>
          <mat-select formControlName="month">
            @for (m of months; track m; let i = $index) {
              <mat-option [value]="i + 1">{{ m }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
      }
      @if (has('department')) {
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Department</mat-label>
          <mat-select formControlName="departmentId">
            <mat-option [value]="null">All departments</mat-option>
            @for (d of departments(); track d.id) {
              <mat-option [value]="d.id">{{ d.name }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
      }
      <span class="spacer"></span>
      <button mat-stroked-button type="button" (click)="exportCsv()" [disabled]="exporting() || !formValid()" data-testid="export-csv"><mat-icon>download</mat-icon> Export CSV</button>
    </form>
    @if (form.hasError('dateRange')) {
      <p class="err" role="alert">“To” must not be before “From”.</p>
    }
    <app-error-message [error]="state().error" (retry)="retry()" />
    <app-client-table [testId]="'report-' + def().id" [columns]="def().columns" [rows]="state().rows" />
  `,
  styles: `.spacer { flex: 1; } .desc { margin: 4px 0 12px; } .err { color: #b3261e; font-size: 13px; }`,
})
export class ReportPanelComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly csvService = inject(ReportService);
  private readonly toast = inject(ToastService);
  private readonly reference = inject(ReferenceDataService);

  readonly def = input.required<ReportDef>();
  protected readonly departments = toSignal(this.reference.departments(), { initialValue: [] });
  protected readonly months = MONTHS;
  protected readonly years = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - 3 + i);
  protected readonly exporting = signal(false);
  private readonly retryTick = signal(0);

  private readonly now = new Date();
  protected readonly form = this.fb.group(
    {
      from: [firstOfMonth(this.now.getFullYear(), 1)],
      to: [todayIso()],
      year: [this.now.getFullYear()],
      month: [this.now.getMonth() + 1],
      departmentId: new FormControl<number | null>(null),
    },
    { validators: dateRange('from', 'to') },
  );

  /** statusChanges as a signal: OnPush templates must not poll `form.invalid`; this re-renders when validity flips. */
  protected readonly formValid = toSignal(this.form.statusChanges.pipe(map((s) => s === 'VALID'), startWith(true)), { initialValue: true });

  private readonly filterValue = toSignal(
    this.form.valueChanges.pipe(debounceTime(250), startWith(null), map(() => (this.form.valid ? (this.form.getRawValue() as ReportFilters) : null))),
    { initialValue: this.form.getRawValue() as ReportFilters },
  );

  protected readonly state = toSignal(
    toObservable(computed(() => ({ def: this.def(), f: this.filterValue(), t: this.retryTick() }))).pipe(
      filter(({ f }) => f !== null),
      switchMap(({ def, f }) =>
        def.load(f!).pipe(
          map((rows): Load => ({ rows, error: null, loading: false })),
          catchError((error: AppError) => of<Load>({ rows: [], error, loading: false })),
          startWith<Load>({ rows: [], error: null, loading: true }),
        ),
      ),
    ),
    { initialValue: { rows: [], error: null, loading: true } as Load },
  );

  protected has(kind: FilterKind): boolean {
    return this.def().filters.includes(kind);
  }

  protected retry(): void {
    this.retryTick.update((n) => n + 1);
  }

  protected exportCsv(): void {
    const f = this.form.getRawValue() as ReportFilters;
    const { csv } = this.def();
    this.exporting.set(true);
    this.csvService.csv(csv.path, csv.params(f)).pipe(tap(() => undefined)).subscribe({
      next: (blob) => {
        downloadBlob(blob, csv.filename);
        this.exporting.set(false);
        this.toast.success('CSV downloaded');
      },
      error: () => this.exporting.set(false),
    });
  }

  constructor() {
    // Month filter implies a date window; keep from/to coherent when the user switches between filter kinds.
    effect(() => {
      const d = this.def();
      untracked(() => {
        if (d.filters.includes('month')) this.form.patchValue({ from: firstOfMonth(this.form.controls.year.value, this.form.controls.month.value), to: lastOfMonth(this.form.controls.year.value, this.form.controls.month.value) }, { emitEvent: false });
      });
    });
  }
}
