import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { catchError, map, of, startWith, switchMap } from 'rxjs';
import { AttendanceCalendar } from '../../core/models/attendance.models';
import { Holiday, LeaveCalendar } from '../../core/models/leave.models';
import { AttendanceService } from '../../core/services/attendance.service';
import { AuthService } from '../../core/services/auth.service';
import { HolidayService } from '../../core/services/holiday.service';
import { LeaveService } from '../../core/services/leave.service';
import { PermissionService } from '../../core/services/permission.service';
import { ReferenceDataService } from '../../core/services/reference-data.service';
import { ToastService } from '../../core/services/toast.service';
import { CellDirective, DataTableComponent, TableColumn } from '../../shared/components/data-table.component';
import { DialogService } from '../../shared/components/dialogs';
import { MonthCalendarComponent } from '../../shared/components/month-calendar.component';
import { PageHeaderComponent } from '../../shared/components/ui-basics';
import { parseIsoDate } from '../../shared/utils/dates';
import { HolidayDialogComponent } from './holiday-dialog.component';

type View = 'attendance' | 'leave' | 'holidays';
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const COLOURS: Record<string, string> = { PRESENT: '#34a853', HALF_DAY: '#fbbc04', ABSENT: '#ea4335', ON_LEAVE: '#4285f4', HOLIDAY: '#9aa0a6', WEEKLY_OFF: '#bdc1c6' };

/**
 * One page, three views (?view=attendance|leave|holidays). The selected view lives in the URL (query param) and the
 * month in signals; each view feeds the same MonthCalendar through a different projected day template.
 */
@Component({
  selector: 'app-calendar-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe, MatButtonModule, MatButtonToggleModule, MatCheckboxModule, MatFormFieldModule, MatIconModule, MatSelectModule, MatTooltipModule,
    MonthCalendarComponent, DataTableComponent, CellDirective, PageHeaderComponent,
  ],
  template: `
    <div class="page">
      <app-page-header title="Calendar & holidays" subtitle="Your attendance, team leave and company holidays" />
      <div class="toolbar-row">
        <mat-button-toggle-group [value]="view()" (change)="setView($event.value)" aria-label="Calendar view" data-testid="calendar-views">
          <mat-button-toggle value="attendance">My attendance</mat-button-toggle>
          <mat-button-toggle value="leave">Leave calendar</mat-button-toggle>
          <mat-button-toggle value="holidays">Holidays</mat-button-toggle>
        </mat-button-toggle-group>
        @if (view() === 'leave' && permissions.has('attendance.team')) {
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Department</mat-label>
            <mat-select [value]="departmentId()" (selectionChange)="departmentId.set($event.value)">
              <mat-option [value]="null">All visible</mat-option>
              @for (d of departments(); track d.id) { <mat-option [value]="d.id">{{ d.name }}</mat-option> }
            </mat-select>
          </mat-form-field>
        }
      </div>

      @switch (view()) {
        @case ('attendance') {
          <div class="panel">
            <app-month-calendar [year]="year()" [month]="month()" (monthChange)="go($event)">
              <ng-template let-day>
                @if (attendanceByDate().get(day.date); as d) {
                  @if (d.holidayName) { <span class="tag" style="background:#9aa0a6" [matTooltip]="d.holidayName">{{ d.holidayName }}</span> }
                  @else if (d.recorded) { <span class="tag" [style.background]="colour(d.recorded.status)">{{ d.recorded.status.replace('_', ' ') }}</span> }
                  @else if (d.calendarDayType === 'WEEKLY_OFF') { <span class="off">Off</span> }
                }
              </ng-template>
            </app-month-calendar>
            @if (!auth.employeeId()) { <p class="muted">Your account is not linked to an employee record.</p> }
          </div>
        }
        @case ('leave') {
          <div class="panel">
            <app-month-calendar [year]="year()" [month]="month()" (monthChange)="go($event)">
              <ng-template let-day>
                @for (h of holidaysOn(day.date); track h.id) { <span class="tag" style="background:#9aa0a6" [matTooltip]="h.name">{{ h.name }}</span> }
                @for (l of leavesOn(day.date); track l.id) {
                  <span class="tag" [style.background]="l.status === 'APPROVED' ? '#4285f4' : '#fbbc04'" [matTooltip]="l.employeeName + ' · ' + l.leaveType + ' (' + l.status + ')'">{{ l.employeeName }}</span>
                }
              </ng-template>
            </app-month-calendar>
            <p class="muted legend"><span class="dot" style="background:#4285f4"></span> Approved <span class="dot" style="background:#fbbc04"></span> Pending <span class="dot" style="background:#9aa0a6"></span> Holiday</p>
          </div>
        }
        @case ('holidays') {
          <div class="panel">
            <div class="toolbar-row">
              <mat-form-field appearance="outline" subscriptSizing="dynamic">
                <mat-label>Year</mat-label>
                <mat-select [value]="year()" (selectionChange)="year.set($event.value)">
                  @for (y of years; track y) { <mat-option [value]="y">{{ y }}</mat-option> }
                </mat-select>
              </mat-form-field>
              @if (permissions.has('holiday.write')) {
                <button mat-flat-button type="button" (click)="editHoliday(null)" data-testid="new-holiday"><mat-icon>add</mat-icon> New holiday</button>
              }
            </div>
            <app-data-table testId="holiday-table" [columns]="columns()" [rows]="holidays()" emptyIcon="celebration" emptyTitle="No holidays this year">
              <ng-template appCell="holidayDate" let-h>{{ asDate(h.holidayDate) | date: 'EEE, MMM d' }}</ng-template>
              <ng-template appCell="isOptional" let-h>{{ h.isOptional ? 'Optional' : 'Fixed' }}</ng-template>
              <ng-template appCell="actions" let-h>
                <div class="row-actions">
                  <button mat-icon-button type="button" aria-label="Edit holiday" (click)="editHoliday(h)"><mat-icon>edit</mat-icon></button>
                  <button mat-icon-button type="button" aria-label="Delete holiday" (click)="removeHoliday(h)"><mat-icon>delete</mat-icon></button>
                </div>
              </ng-template>
            </app-data-table>

            <h3>Weekly offs</h3>
            <div class="offs" data-testid="weekly-offs">
              @for (d of days; track d; let i = $index) {
                <mat-checkbox [checked]="weeklyOffs().has(i)" [disabled]="!permissions.has('holiday.write')" (change)="toggleOff(i, $event.checked)">{{ d }}</mat-checkbox>
              }
            </div>
          </div>
        }
      }
    </div>
  `,
  styles: `
    .tag { display: block; color: #fff; border-radius: 4px; padding: 0 4px; margin-bottom: 2px; font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .off { color: var(--ems-muted); font-size: 11px; }
    .legend { display: flex; gap: 12px; align-items: center; margin: 12px 0 0; }
    .dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 4px; }
    h3 { margin: 24px 0 8px; font-weight: 500; }
    .offs { display: flex; gap: 12px; flex-wrap: wrap; }
  `,
})
export class CalendarPageComponent {
  protected readonly auth = inject(AuthService);
  protected readonly permissions = inject(PermissionService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly attendance = inject(AttendanceService);
  private readonly leave = inject(LeaveService);
  private readonly holiday = inject(HolidayService);
  private readonly reference = inject(ReferenceDataService);
  private readonly dialog = inject(MatDialog);
  private readonly dialogs = inject(DialogService);
  private readonly toast = inject(ToastService);

  protected readonly days = DAYS;
  protected readonly asDate = parseIsoDate;
  protected readonly years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);
  protected readonly departments = toSignal(this.reference.departments(), { initialValue: [] });

  protected readonly view = toSignal(
    this.route.queryParamMap.pipe(map((q) => (['attendance', 'leave', 'holidays'].includes(q.get('view') ?? '') ? (q.get('view') as View) : 'attendance'))),
    { initialValue: 'attendance' as View },
  );
  private readonly now = new Date();
  protected readonly year = signal(this.now.getFullYear());
  protected readonly month = signal(this.now.getMonth() + 1);
  protected readonly departmentId = signal<number | null>(null);
  private readonly tick = signal(0);

  protected readonly attendanceCal = toSignal(
    toObservable(computed(() => ({ v: this.view(), y: this.year(), m: this.month(), e: this.auth.employeeId() }))).pipe(
      switchMap(({ v, y, m, e }) => (v === 'attendance' && e ? this.attendance.calendar(y, m, e).pipe(catchError(() => of(null))) : of(null))),
    ),
    { initialValue: null as AttendanceCalendar | null },
  );
  protected readonly attendanceByDate = computed(() => new Map((this.attendanceCal()?.days ?? []).map((d) => [d.date, d])));

  protected readonly leaveCal = toSignal(
    toObservable(computed(() => ({ v: this.view(), y: this.year(), m: this.month(), d: this.departmentId() }))).pipe(
      switchMap(({ v, y, m, d }) => (v === 'leave' ? this.leave.calendar(y, m, d).pipe(catchError(() => of(null))) : of(null))),
    ),
    { initialValue: null as LeaveCalendar | null },
  );

  protected readonly holidays = toSignal(
    toObservable(computed(() => ({ v: this.view(), y: this.year(), t: this.tick() }))).pipe(
      switchMap(({ v, y }) => (v === 'holidays' ? this.holiday.list(`${y}-01-01`, `${y}-12-31`).pipe(catchError(() => of([] as Holiday[]))) : of([] as Holiday[]))),
      startWith([] as Holiday[]),
    ),
    { initialValue: [] as Holiday[] },
  );

  protected readonly weeklyOffs = toSignal(
    toObservable(this.tick).pipe(switchMap(() => this.holiday.weeklyOffs().pipe(map((w): Set<number> => new Set(w.map((x) => x.dayOfWeek))), catchError(() => of(new Set<number>()))))),
    { initialValue: new Set<number>() },
  );

  protected readonly columns = computed<TableColumn[]>(() => [
    { key: 'holidayDate', label: 'Date' }, { key: 'name', label: 'Holiday' }, { key: 'location', label: 'Location' }, { key: 'isOptional', label: 'Type' },
    ...(this.permissions.has('holiday.write') ? [{ key: 'actions', label: '', align: 'end' as const }] : []),
  ]);

  protected colour = (s: string) => COLOURS[s] ?? '#9aa0a6';
  protected holidaysOn = (date: string) => (this.leaveCal()?.holidays ?? []).filter((h) => h.holidayDate.slice(0, 10) === date);
  protected leavesOn = (date: string) => (this.leaveCal()?.leaves ?? []).filter((l) => l.status !== 'REJECTED' && l.status !== 'CANCELLED' && l.startDate.slice(0, 10) <= date && l.endDate.slice(0, 10) >= date);

  protected setView(v: View): void {
    void this.router.navigate([], { relativeTo: this.route, queryParams: { view: v }, queryParamsHandling: 'merge' });
  }

  protected go(e: { year: number; month: number }): void {
    this.year.set(e.year);
    this.month.set(e.month);
  }

  protected editHoliday(h: Holiday | null): void {
    this.dialog.open<HolidayDialogComponent, Holiday | null, boolean>(HolidayDialogComponent, { data: h, maxWidth: '95vw' }).afterClosed().subscribe((ok) => {
      if (ok) {
        this.toast.success(h ? 'Holiday updated' : 'Holiday added');
        this.tick.update((n) => n + 1);
      }
    });
  }

  protected removeHoliday(h: Holiday): void {
    this.dialogs.confirm({ title: `Delete “${h.name}”?`, message: 'This holiday will no longer appear in calendars.', confirmLabel: 'Delete', danger: true }).subscribe(() => {
      this.holiday.remove(h.id).subscribe(() => {
        this.toast.success('Holiday deleted');
        this.tick.update((n) => n + 1);
      });
    });
  }

  protected toggleOff(day: number, on: boolean): void {
    const next = new Set(this.weeklyOffs());
    if (on) next.add(day);
    else next.delete(day);
    this.holiday.setWeeklyOffs([...next].sort()).subscribe(() => {
      this.toast.success('Weekly offs updated');
      this.tick.update((n) => n + 1);
    });
  }
}
