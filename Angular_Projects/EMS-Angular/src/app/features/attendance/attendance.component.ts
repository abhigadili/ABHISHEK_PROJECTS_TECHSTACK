import { KeyValuePipe, DatePipe, TitleCasePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { catchError, debounceTime, map, of, startWith, switchMap } from 'rxjs';
import { AppError, PageMeta } from '../../core/models/api.models';
import { ATTENDANCE_STATUSES, AttendanceRecord, AttendanceStatus, WORK_MODES, WorkMode } from '../../core/models/attendance.models';
import { AttendanceService } from '../../core/services/attendance.service';
import { AuthService } from '../../core/services/auth.service';
import { PermissionService } from '../../core/services/permission.service';
import { ToastService } from '../../core/services/toast.service';
import { CellDirective, DataTableComponent, TableColumn } from '../../shared/components/data-table.component';
import { EmployeeSelectComponent } from '../../shared/components/employee-select.component';
import { LiveClockComponent } from '../../shared/components/live-clock.component';
import { ErrorMessageComponent, PageHeaderComponent, StatusBadgeComponent } from '../../shared/components/ui-basics';
import { HasPermissionDirective } from '../../shared/directives/directives';
import { ServerDateTimePipe, WorkingHoursPipe } from '../../shared/pipes/pipes';
import { firstOfMonth, todayIso } from '../../shared/utils/dates';
import { dateRange } from '../../shared/validators/validators';
import { AttendanceEditDialogComponent } from './attendance-edit-dialog.component';

interface Result { items: AttendanceRecord[]; meta: PageMeta | null; error: AppError | null }

/**
 * Attendance home: today's check-in/out card, a filterable history (mine or team scope) and a period summary.
 * Filters are a typed reactive form (date range validated); valid, debounced changes feed a switchMap pipeline.
 */
@Component({
  selector: 'app-attendance',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TitleCasePipe, ReactiveFormsModule, RouterLink, KeyValuePipe, DatePipe, MatButtonModule, MatButtonToggleModule, MatCardModule, MatFormFieldModule, MatIconModule, MatInputModule,
    MatSelectModule, DataTableComponent, CellDirective, EmployeeSelectComponent, PageHeaderComponent, ErrorMessageComponent, StatusBadgeComponent, HasPermissionDirective,
    ServerDateTimePipe, WorkingHoursPipe, LiveClockComponent,
  ],
  template: `
    <div class="page">
      <app-page-header title="Attendance" subtitle="Check in, review your records and see your period summary">
        <a pageActions mat-stroked-button routerLink="/attendance/reports" *appHasPermission="'attendance.team'"><mat-icon>assessment</mat-icon> Reports</a>
        <button pageActions mat-flat-button type="button" (click)="addManual()" *appHasPermission="'attendance.correct'" data-testid="add-attendance"><mat-icon>add</mat-icon> Add record</button>
      </app-page-header>

      @if (auth.employeeId()) {
        <mat-card appearance="outlined" class="today" data-testid="today-card">
          <mat-card-content>
            <div class="when"><mat-icon>today</mat-icon> <strong>{{ today | date: 'fullDate' }}</strong> · <app-live-clock /></div>
            @if (todayRecord(); as r) {
              <div class="state">
                <span>In: <strong>{{ r.checkInAt | serverDateTime: 'time' }}</strong></span>
                <span>Out: <strong>{{ r.checkOutAt | serverDateTime: 'time' }}</strong></span>
                <span>Hours: <strong>{{ r.workingHours | workingHours }}</strong></span>
                <app-status-badge [value]="r.status" [label]="r.status.replace('_', ' ') | titlecase" />
              </div>
            } @else {
              <div class="state muted">You have not checked in today.</div>
            }
            <div class="check">
              @if (!todayRecord()) {
                <mat-form-field appearance="outline" subscriptSizing="dynamic">
                  <mat-label>Work mode</mat-label>
                  <mat-select [value]="mode()" (selectionChange)="mode.set($event.value)" data-testid="work-mode">
                    @for (m of modes; track m) {
                      <mat-option [value]="m">{{ m }}</mat-option>
                    }
                  </mat-select>
                </mat-form-field>
                <button mat-flat-button color="primary" type="button" [disabled]="busy()" (click)="checkIn()" data-testid="check-in"><mat-icon>login</mat-icon> Check in</button>
              } @else if (!todayRecord()!.checkOutAt) {
                <button mat-flat-button color="accent" type="button" [disabled]="busy()" (click)="checkOut()" data-testid="check-out"><mat-icon>logout</mat-icon> Check out</button>
              } @else {
                <span class="muted">Done for today ✔</span>
              }
            </div>
          </mat-card-content>
        </mat-card>
      } @else {
        <p class="muted">Your account is not linked to an employee record, so check-in is unavailable.</p>
      }

      <div class="panel">
        <div class="toolbar-row">
          @if (permissions.has('attendance.team')) {
            <mat-button-toggle-group [value]="scope()" (change)="scope.set($event.value); page.set(1)" aria-label="Scope" data-testid="scope-toggle">
              <mat-button-toggle value="mine">My records</mat-button-toggle>
              <mat-button-toggle value="team">Team / all</mat-button-toggle>
            </mat-button-toggle-group>
          }
        </div>
        <form class="toolbar-row" [formGroup]="filters" novalidate>
          <mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>From</mat-label><input matInput type="date" formControlName="from" data-testid="att-from" /></mat-form-field>
          <mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>To</mat-label><input matInput type="date" formControlName="to" data-testid="att-to" /></mat-form-field>
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Status</mat-label>
            <mat-select formControlName="status">
              <mat-option [value]="null">Any</mat-option>
              @for (s of statuses; track s) {
                <mat-option [value]="s">{{ s.replace('_', ' ') }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
          @if (scope() === 'team') {
            <div class="emp"><app-employee-select label="Employee" formControlName="employeeId" status="ALL" /></div>
          }
        </form>
        @if (filters.hasError('dateRange')) {
          <p class="err" role="alert">“To” must not be before “From”.</p>
        }

        @if (summary(); as s) {
          <div class="summary" data-testid="att-summary">
            @for (kv of s.byStatus | keyvalue; track kv.key) {
              <app-status-badge [value]="kv.key" [label]="(kv.key.replace('_', ' ') | titlecase) + ': ' + kv.value" />
            } @empty {
              <span class="muted">No records in this period.</span>
            }
            <span class="muted">· {{ s.totalRecords }} records · {{ s.totalHours | workingHours }} worked</span>
          </div>
        }

        <app-error-message [error]="result().error" (retry)="reload()" />
        <app-data-table testId="attendance-table" [columns]="columns()" [rows]="result().items" [meta]="result().meta" [clickable]="true" emptyIcon="schedule" emptyTitle="No attendance records"
          (pageChange)="page.set($event.page); limit.set($event.limit)" (rowClick)="open($event)">
          <ng-template appCell="workDate" let-r>{{ r.workDate | date: 'EEE, MMM d' }}</ng-template>
          <ng-template appCell="checkInAt" let-r>{{ r.checkInAt | serverDateTime: 'time' }}</ng-template>
          <ng-template appCell="checkOutAt" let-r>{{ r.checkOutAt | serverDateTime: 'time' }}</ng-template>
          <ng-template appCell="workingHours" let-r>{{ r.workingHours | workingHours }}</ng-template>
          <ng-template appCell="status" let-r><app-status-badge [value]="r.status" [label]="r.status.replace('_', ' ') | titlecase" /></ng-template>
          <ng-template appCell="workMode" let-r>{{ r.workMode ?? '—' }}</ng-template>
        </app-data-table>
      </div>
    </div>
  `,
  styles: `
    .today { margin-bottom: 16px; }
    .today mat-card-content { display: flex; gap: 24px; align-items: center; flex-wrap: wrap; padding: 16px 20px; }
    .when { display: flex; align-items: center; gap: 8px; }
    .state { display: flex; gap: 16px; align-items: center; flex-wrap: wrap; flex: 1; }
    .check { display: flex; gap: 12px; align-items: center; }
    .summary { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-bottom: 12px; }
    .emp { flex: 1 1 280px; margin-bottom: -22px; }
    .err { color: #b3261e; font-size: 13px; margin: 0 0 8px; }
  `,
})
export class AttendanceComponent {
  protected readonly auth = inject(AuthService);
  protected readonly permissions = inject(PermissionService);
  private readonly svc = inject(AttendanceService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly toast = inject(ToastService);

  protected readonly today = new Date();
  protected readonly modes = WORK_MODES;
  protected readonly statuses = ATTENDANCE_STATUSES;
  protected readonly mode = signal<WorkMode>('OFFICE');
  protected readonly busy = signal(false);
  protected readonly scope = signal<'mine' | 'team'>('mine');
  protected readonly page = signal(1);
  protected readonly limit = signal(10);
  private readonly refresh = signal(0);

  protected readonly filters = this.fb.group(
    {
      from: [firstOfMonth(this.today.getFullYear(), this.today.getMonth() + 1)],
      to: [todayIso()],
      status: this.fb.control<AttendanceStatus | null>(null),
      employeeId: this.fb.control<number | null>(null),
    },
    { validators: dateRange('from', 'to') },
  );

  /** Valid filter values as a signal (invalid ranges are ignored instead of hitting the API). */
  private readonly filterValue = toSignal(
    this.filters.valueChanges.pipe(
      debounceTime(250),
      startWith(this.filters.getRawValue()),
      map(() => (this.filters.valid ? this.filters.getRawValue() : null)),
    ),
    { initialValue: this.filters.getRawValue() },
  );

  protected readonly todayRecord = toSignal(
    toObservable(computed(() => ({ id: this.auth.employeeId(), tick: this.refresh() }))).pipe(
      switchMap(({ id }) => (id ? this.svc.mine({ from: todayIso(), to: todayIso(), limit: 1 }).pipe(map((p) => p.items[0] ?? null), catchError(() => of(null))) : of(null))),
    ),
    { initialValue: null },
  );

  private readonly query = computed(() => {
    const f = this.filterValue();
    return f ? { ...f, scope: this.scope(), page: this.page(), limit: this.limit(), tick: this.refresh() } : null;
  });

  protected readonly result = toSignal(
    toObservable(this.query).pipe(
      switchMap((q) => {
        if (!q) return of<Result>({ items: [], meta: null, error: null });
        const call = q.scope === 'mine' ? this.svc.mine.bind(this.svc) : this.svc.list.bind(this.svc);
        return call({ from: q.from, to: q.to, status: q.status, employeeId: q.scope === 'team' ? q.employeeId : null, page: q.page, limit: q.limit }).pipe(
          map((p): Result => ({ items: p.items, meta: p.meta, error: null })),
          catchError((error: AppError) => of<Result>({ items: [], meta: null, error })),
        );
      }),
    ),
    { initialValue: { items: [], meta: null, error: null } as Result },
  );

  protected readonly summary = toSignal(
    toObservable(this.query).pipe(
      switchMap((q) =>
        q ? this.svc.summary({ from: q.from, to: q.to, employeeId: q.scope === 'team' ? q.employeeId : null }).pipe(catchError(() => of(null))) : of(null),
      ),
    ),
    { initialValue: null },
  );

  protected readonly columns = computed<TableColumn[]>(() => [
    { key: 'workDate', label: 'Date' },
    ...(this.scope() === 'team' ? [{ key: 'employeeName', label: 'Employee' }] : []),
    { key: 'checkInAt', label: 'Check-in' },
    { key: 'checkOutAt', label: 'Check-out' },
    { key: 'workingHours', label: 'Hours' },
    { key: 'status', label: 'Status' },
    { key: 'workMode', label: 'Mode' },
  ]);

  protected checkIn(): void {
    this.busy.set(true);
    this.svc.checkIn(this.mode()).subscribe({
      next: () => {
        this.toast.success('Checked in');
        this.busy.set(false);
        this.reload();
      },
      error: () => this.busy.set(false),
    });
  }

  protected checkOut(): void {
    this.busy.set(true);
    this.svc.checkOut().subscribe({
      next: () => {
        this.toast.success('Checked out');
        this.busy.set(false);
        this.reload();
      },
      error: () => this.busy.set(false),
    });
  }

  protected addManual(): void {
    this.dialog.open(AttendanceEditDialogComponent, { data: {}, maxWidth: '95vw' }).afterClosed().subscribe((ok) => {
      if (ok) {
        this.toast.success('Attendance record added');
        this.reload();
      }
    });
  }

  protected open(r: AttendanceRecord): void {
    void this.router.navigate(['/attendance', r.id]);
  }

  protected reload(): void {
    this.refresh.update((n) => n + 1);
  }
}
