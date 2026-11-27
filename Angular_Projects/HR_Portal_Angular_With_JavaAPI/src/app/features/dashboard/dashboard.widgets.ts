import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { injectOp } from '../../api/queries/op-query';
import { LanguageService } from '../../core/services/language.service';
import { PermissionService } from '../../core/services/permission.service';
import { ChartCardComponent } from '../../shared/charts/chart-card.component';
import { barOption, donutOption, lineOption } from '../../shared/charts/chart-options';
import { CardComponent } from '../../shared/components/ui.components';
import { RefService } from '../../shared/components/ref.service';
import { StatusBadgeComponent } from '../../shared/components/value.components';
import { FmtDatePipe, FmtDateTimePipe } from '../../shared/pipes/format.pipes';
import { OpButtonComponent } from '../../shared/op/op-button.component';
import { OpViewComponent } from '../../shared/op/op-view.component';
import { KpiCardComponent } from '../../shared/components/ui.components';
import { isoDate } from '../../shared/utilities/date';

export interface DashFilters { month: string; year: number; dept: string }
const dash = (t: TranslateService, k: string) => t.instant(`hr.dashboard.${k}`);
const status = (t: TranslateService, s: string) => { const k = `hr.statuses.${s}`; const v = t.instant(k); return v === k ? s : v; };

@Component({
  selector: 'app-dash-kpis', standalone: true, changeDetection: ChangeDetectionStrategy.OnPush, imports: [KpiCardComponent, RouterLink, TranslateModule],
  template: `<div class="row g-3">
    @if (can('reporting.headcount')) { <div class="col-12 col-sm-6 col-lg-4 col-xxl-3"><a routerLink="/employees" class="d-block h-100 text-decoration-none"><app-kpi-card [label]="'hr.dashboard.totalEmployees' | translate" [value]="exec.data()?.total ?? '—'" [loading]="exec.isLoading()" icon="pi-users" /></a></div>
      <div class="col-12 col-sm-6 col-lg-4 col-xxl-3"><a routerLink="/employees" class="d-block h-100 text-decoration-none"><app-kpi-card [label]="'hr.dashboard.activeEmployees' | translate" [value]="exec.data()?.active ?? '—'" [loading]="exec.isLoading()" icon="pi-user-plus" color="var(--hr-success)" /></a></div> }
    @if (can('leave.teamCalendar')) { <div class="col-12 col-sm-6 col-lg-4 col-xxl-3"><a routerLink="/leave" class="d-block h-100 text-decoration-none"><app-kpi-card [label]="'hr.dashboard.onLeave' | translate" [value]="onLeaveCount()" [loading]="onLeave.isLoading()" icon="pi-send" color="var(--hr-info)" /></a></div> }
    @if (can('attendance.daily')) { <div class="col-12 col-sm-6 col-lg-4 col-xxl-3"><a routerLink="/attendance" class="d-block h-100 text-decoration-none"><app-kpi-card [label]="'hr.dashboard.present' | translate" [value]="present()" [loading]="daily.isLoading()" icon="pi-user-plus" color="var(--hr-success)" /></a></div>
      <div class="col-12 col-sm-6 col-lg-4 col-xxl-3"><a routerLink="/attendance" class="d-block h-100 text-decoration-none"><app-kpi-card [label]="'hr.dashboard.absent' | translate" [value]="absent()" [loading]="daily.isLoading()" icon="pi-user-minus" color="var(--hr-danger)" /></a></div> }
    @if (can('leave.pending')) { <div class="col-12 col-sm-6 col-lg-4 col-xxl-3"><a routerLink="/approvals" class="d-block h-100 text-decoration-none"><app-kpi-card [label]="'hr.dashboard.pendingLeaves' | translate" [value]="pendLeave.data()?.length ?? '—'" [loading]="pendLeave.isLoading()" icon="pi-clock" color="var(--hr-warning)" /></a></div> }
    <div class="col-12 col-sm-6 col-lg-4 col-xxl-3"><a routerLink="/holidays" class="d-block h-100 text-decoration-none"><app-kpi-card [label]="'hr.dashboard.upcomingHolidays' | translate" [value]="hol.data()?.length ?? '—'" [loading]="hol.isLoading()" icon="pi-gift" [hint]="holHint()" /></a></div>
    @if (can('timesheet.pending')) { <div class="col-12 col-sm-6 col-lg-4 col-xxl-3"><a routerLink="/approvals" class="d-block h-100 text-decoration-none"><app-kpi-card [label]="'hr.dashboard.pendingTimesheets' | translate" [value]="ts.data()?.length ?? '—'" [loading]="ts.isLoading()" icon="pi-stopwatch" color="var(--hr-warning)" /></a></div> }
    @if (can('performance.pending')) { <div class="col-12 col-sm-6 col-lg-4 col-xxl-3"><a routerLink="/performance" class="d-block h-100 text-decoration-none"><app-kpi-card [label]="'hr.dashboard.pendingReviews' | translate" [value]="rev.data()?.length ?? '—'" [loading]="rev.isLoading()" icon="pi-bullseye" /></a></div> }
    @if (can('payroll.list')) { <div class="col-12 col-sm-6 col-lg-4 col-xxl-3"><a routerLink="/payroll" class="d-block h-100 text-decoration-none"><app-kpi-card [label]="'hr.dashboard.payroll' | translate" [value]="run()?.status ?? '—'" [loading]="pay.isLoading()" icon="pi-wallet" [hint]="run()?.month ?? ''" /></a></div> }
    @if (can('exit.summary')) { <div class="col-12 col-sm-6 col-lg-4 col-xxl-3"><a routerLink="/exit" class="d-block h-100 text-decoration-none"><app-kpi-card [label]="'hr.dashboard.openExits' | translate" [value]="openExits()" [loading]="exits.isLoading()" icon="pi-sign-out" color="var(--hr-danger)" /></a></div> }
  </div>`,
})
export class DashKpisComponent {
  private perm = inject(PermissionService); private lang = inject(LanguageService);
  f = input.required<DashFilters>(); can = (o: string) => this.perm.canCall(o);
  today = isoDate(new Date());
  exec = injectOp<any>('reporting.headcount', () => ({ query: { groupBy: 'department' } }), () => ({ enabled: this.can('reporting.headcount') }));
  daily = injectOp<any[]>('attendance.daily', () => ({ query: { date: this.today } }), () => ({ enabled: this.can('attendance.daily') }));
  onLeave = injectOp<any[]>('leave.teamCalendar', () => ({ query: { from: this.today, to: this.today, departmentId: this.f().dept || undefined } }), () => ({ enabled: this.can('leave.teamCalendar') }));
  pendLeave = injectOp<any[]>('leave.pending', undefined, () => ({ enabled: this.can('leave.pending') }));
  hol = injectOp<any[]>('holiday.upcoming', () => ({ query: { limit: 5 } }));
  ts = injectOp<any[]>('timesheet.pending', undefined, () => ({ enabled: this.can('timesheet.pending') }));
  rev = injectOp<any[]>('performance.pending', undefined, () => ({ enabled: this.can('performance.pending') }));
  pay = injectOp<any>('payroll.list', () => ({ query: { size: 1 } }), () => ({ enabled: this.can('payroll.list') }));
  exits = injectOp<any>('exit.summary', undefined, () => ({ enabled: this.can('exit.summary') }));
  rows = computed<any[]>(() => this.daily.data() ?? []);
  present = computed(() => this.rows().filter((r) => ['PRESENT', 'LATE', 'HALF_DAY', 'WFH'].includes(r.status)).length);
  absent = computed(() => this.rows().filter((r) => r.status === 'ABSENT').length);
  onLeaveCount = computed(() => (this.onLeave.data() ?? []).filter((e) => e.status === 'APPROVED').length);
  run = computed(() => this.pay.data()?.content?.[0]);
  holHint = computed(() => { const h = this.hol.data()?.[0]; return h ? `${h.name} · ${this.lang.date(h.holidayDate)}` : ''; });
  openExits = computed(() => { const d = this.exits.data(); return d ? Object.entries(d.byStatus ?? {}).filter(([k]) => !['COMPLETED', 'EXITED', 'WITHDRAWN', 'REJECTED'].includes(k)).reduce((a, [, v]) => a + Number(v), 0) : '—'; });
}

@Component({
  selector: 'app-dash-headcount', standalone: true, changeDetection: ChangeDetectionStrategy.OnPush, imports: [ChartCardComponent, FormsModule, TranslateModule],
  template: `<app-chart-card [title]="(by() === 'department' ? 'hr.dashboard.byDepartment' : 'hr.dashboard.byDesignation') | translate" [loading]="q.isLoading()" [error]="q.error()" [retryFn]="refetch" [empty]="!data().length" [build]="build">
    <select actions class="form-select" style="width:auto" [ngModel]="by()" (ngModelChange)="by.set($event)" aria-label="group by"><option value="department">{{ 'common.department' | translate }}</option><option value="designation">{{ 'common.designation' | translate }}</option></select></app-chart-card>`,
})
export class DashHeadcountComponent {
  private refs = inject(RefService); private tr = inject(TranslateService); private perm = inject(PermissionService);
  f = input.required<DashFilters>(); by = signal<'department' | 'designation'>('department');
  q = injectOp<any>('reporting.headcount', () => ({ query: { groupBy: this.by() } }), () => ({ enabled: this.perm.canCall('reporting.headcount') }));
  data = computed(() => (this.q.data()?.rows ?? []).filter((r: any) => this.by() !== 'department' || !this.f().dept || r.key === this.f().dept).map((r: any) => ({ name: this.by() === 'designation' ? this.refs.label('designation', r.key) : r.label, count: r.count })));
  refetch = () => this.q.refetch(); build = (dark: boolean) => barOption(dark, this.data(), 'name', [{ key: 'count', label: this.tr.instant('common.total') }]);
}

@Component({
  selector: 'app-dash-leaves', standalone: true, changeDetection: ChangeDetectionStrategy.OnPush, imports: [ChartCardComponent],
  template: `<app-chart-card [title]="title()" [loading]="q.isLoading()" [error]="q.error()" [retryFn]="refetch" [empty]="!data().length" [build]="build" />`,
})
export class DashLeavesComponent {
  private tr = inject(TranslateService); private perm = inject(PermissionService);
  f = input.required<DashFilters>();
  q = injectOp<any>('reporting.leave', () => ({ query: { period: this.f().month } }), () => ({ enabled: this.perm.canCall('reporting.leave') }));
  title = computed(() => `${dash(this.tr, 'leaveUtilisation')} · ${this.f().month}`);
  data = computed(() => {
    const rows: any[] = this.q.data()?.rows ?? [];
    const agg = new Map<string, number>(); rows.filter((r) => r.status === 'APPROVED').forEach((r) => agg.set(r.leaveType, (agg.get(r.leaveType) ?? 0) + Number(r.days)));
    if (agg.size) return [...agg].map(([name, value]) => ({ name, value }));
    const apps = new Map<string, number>(); rows.forEach((r) => apps.set(r.status, (apps.get(r.status) ?? 0) + Number(r.applications)));
    return [...apps].map(([name, value]) => ({ name: status(this.tr, name), value }));
  });
  refetch = () => this.q.refetch(); build = (dark: boolean) => donutOption(dark, this.data());
}

@Component({
  selector: 'app-dash-attendance', standalone: true, changeDetection: ChangeDetectionStrategy.OnPush, imports: [ChartCardComponent],
  template: `<app-chart-card [title]="title()" [loading]="q.isLoading()" [error]="q.error()" [retryFn]="refetch" [empty]="!data().length" [build]="build" />`,
})
export class DashAttendanceComponent {
  private tr = inject(TranslateService); private perm = inject(PermissionService);
  f = input.required<DashFilters>();
  q = injectOp<any>('reporting.attendance', () => ({ query: { month: this.f().month } }), () => ({ enabled: this.perm.canCall('reporting.attendance') }));
  title = computed(() => `${dash(this.tr, 'attendanceTrend')} · ${this.f().month}`);
  data = computed(() => (this.q.data()?.rows ?? []).filter((r: any) => !this.f().dept || r.departmentId === this.f().dept).map((r: any) => ({ name: r.departmentName, late: r.lateCount, days: r.employeeDays })));
  refetch = () => this.q.refetch(); build = (dark: boolean) => barOption(dark, this.data(), 'name', [{ key: 'days', label: 'Employee-days' }, { key: 'late', label: 'Late' }]);
}

@Component({
  selector: 'app-dash-joining', standalone: true, changeDetection: ChangeDetectionStrategy.OnPush, imports: [ChartCardComponent],
  template: `<app-chart-card [title]="title()" [loading]="q.isLoading()" [error]="q.error()" [retryFn]="refetch" [empty]="!q.data()" [build]="build" />`,
})
export class DashJoiningComponent {
  private tr = inject(TranslateService); private perm = inject(PermissionService); private lang = inject(LanguageService);
  f = input.required<DashFilters>();
  q = injectOp<any>('reporting.joiningExit', () => ({ query: { year: this.f().year } }), () => ({ enabled: this.perm.canCall('reporting.joiningExit') }));
  title = computed(() => `${dash(this.tr, 'joining')} · ${this.f().year}`);
  data = computed(() => {
    const y = this.f().year; const m = new Map<string, any>();
    for (let i = 1; i <= 12; i++) m.set(`${y}-${String(i).padStart(2, '0')}`, { month: new Intl.DateTimeFormat(this.lang.locale(), { month: 'short' }).format(new Date(y, i - 1, 1)), joiners: 0, leavers: 0 });
    (this.q.data()?.joiners ?? []).forEach((r: any) => m.get(r.month) && (m.get(r.month).joiners = r.count));
    (this.q.data()?.leavers ?? []).forEach((r: any) => m.get(r.month) && (m.get(r.month).leavers = r.count));
    return [...m.values()];
  });
  refetch = () => this.q.refetch(); build = (dark: boolean) => lineOption(dark, this.data(), 'month', [{ key: 'joiners', label: 'Joiners' }, { key: 'leavers', label: 'Leavers' }]);
}

@Component({
  selector: 'app-dash-projects', standalone: true, changeDetection: ChangeDetectionStrategy.OnPush, imports: [ChartCardComponent, TranslateModule],
  template: `<app-chart-card [title]="'hr.dashboard.projectAllocation' | translate" [loading]="q.isLoading()" [error]="q.error()" [retryFn]="refetch" [empty]="!data().length" [build]="build" />`,
})
export class DashProjectsComponent {
  private perm = inject(PermissionService);
  q = injectOp<any[]>('reporting.allocation', undefined, () => ({ enabled: this.perm.canCall('reporting.allocation') }));
  data = computed(() => (this.q.data() ?? []).map((r: any) => ({ name: r.projectName ?? r.name ?? r.project, allocation: r.totalAllocation ?? r.allocationPercent ?? r.members ?? r.headcount ?? 0 })));
  refetch = () => this.q.refetch(); build = (dark: boolean) => barOption(dark, this.data(), 'name', [{ key: 'allocation', label: 'Allocation' }]);
}

@Component({
  selector: 'app-dash-timesheets', standalone: true, changeDetection: ChangeDetectionStrategy.OnPush, imports: [ChartCardComponent],
  template: `<app-chart-card [title]="title()" [loading]="q.isLoading()" [error]="q.error()" [retryFn]="refetch" [empty]="!data().length" [build]="build" />`,
})
export class DashTimesheetsComponent {
  private tr = inject(TranslateService); private perm = inject(PermissionService);
  f = input.required<DashFilters>();
  q = injectOp<any>('reporting.timesheets', () => ({ query: { month: this.f().month } }), () => ({ enabled: this.perm.canCall('reporting.timesheets') }));
  title = computed(() => `${dash(this.tr, 'timesheetUtil')} · ${this.f().month}`);
  data = computed(() => (this.q.data()?.rows ?? []).map((r: any) => ({ name: r.employeeName, billable: Number(r.billableHours), nonBillable: Number(r.totalHours) - Number(r.billableHours) })));
  refetch = () => this.q.refetch(); build = (dark: boolean) => barOption(dark, this.data(), 'name', [{ key: 'billable', label: 'Billable h' }, { key: 'nonBillable', label: 'Non-billable h' }], true);
}

@Component({
  selector: 'app-dash-performance', standalone: true, changeDetection: ChangeDetectionStrategy.OnPush, imports: [ChartCardComponent, FormsModule, TranslateModule],
  template: `<app-chart-card [title]="'hr.dashboard.reviewCompletion' | translate" [loading]="cycles.isLoading() || q.isLoading()" [error]="q.error()" [retryFn]="refetch" [empty]="!data().length" [build]="build">
    <select actions class="form-select" style="width:auto" [ngModel]="cycle()" (ngModelChange)="cid.set($event)" aria-label="cycle">@for (c of cycles.data() ?? []; track c.id) { <option [value]="c.id">{{ c.name }}</option> }</select></app-chart-card>`,
})
export class DashPerformanceComponent {
  private tr = inject(TranslateService); private perm = inject(PermissionService);
  cycles = injectOp<any[]>('performance.cycles'); cid = signal('');
  cycle = computed(() => this.cid() || (this.cycles.data() ?? []).find((c) => c.status !== 'DRAFT')?.id || '');
  q = injectOp<any>('reporting.performance', () => ({ query: { cycleId: this.cycle() } }), () => ({ enabled: !!this.cycle() && this.perm.canCall('reporting.performance') }));
  data = computed(() => { const d = this.q.data(); const by = d?.byStatus ?? d?.statusCounts ?? d?.summary?.byStatus ?? {}; return Object.entries(by).map(([name, value]) => ({ name: status(this.tr, name), value: Number(value) })); });
  refetch = () => this.q.refetch(); build = (dark: boolean) => donutOption(dark, this.data());
}

@Component({
  selector: 'app-dash-holidays', standalone: true, changeDetection: ChangeDetectionStrategy.OnPush, imports: [CardComponent, RouterLink, TranslateModule, FmtDatePipe],
  template: `<app-card [title]="'hr.dashboard.upcomingHolidays' | translate" class="d-block h-100"><a actions routerLink="/holidays" style="font-size:12px">{{ 'common.view' | translate }} →</a>
    <ul class="m-0 list-unstyled">@for (h of q.data() ?? []; track h.id) { <li class="d-flex justify-content-between py-2" style="font-size:13px;border-bottom:1px solid var(--hr-border)"><span>{{ h.name }}</span><span class="text-muted">{{ h.holidayDate | fmtDate }}</span></li> } @empty { <li class="text-muted">{{ 'common.noData' | translate }}</li> }</ul></app-card>`,
  styles: [`:host { display: block; height: 100%; } :host ::ng-deep .hr-card { height: 100%; }`],
})
export class DashHolidaysComponent { q = injectOp<any[]>('holiday.upcoming', () => ({ query: { limit: 6 } })); }

@Component({
  selector: 'app-dash-overview', standalone: true, changeDetection: ChangeDetectionStrategy.OnPush, imports: [OpViewComponent],
  template: `<app-op-view [op]="op()" [title]="title()" [hide]="hide" [cols]="3" />`,
})
export class DashOverviewComponent { op = input.required<'reporting.employee' | 'reporting.manager'>(); title = input(''); hide = ['employeeId', 'assembledInMs', 'profile']; }

@Component({
  selector: 'app-dash-my-day', standalone: true, changeDetection: ChangeDetectionStrategy.OnPush, imports: [CardComponent, OpButtonComponent, StatusBadgeComponent, TranslateModule],
  template: `<app-card [title]="'hr.dashboard.myDay' | translate" class="d-block h-100"><span actions><app-status-badge [value]="a()?.status" /></span>
    <div class="d-flex gap-2 flex-wrap mb-3"><app-op-button op="attendance.checkIn" [label]="'hr.dashboard.checkIn' | translate" variant="primary" size="md" [confirm]="false" /><app-op-button op="attendance.checkOut" [label]="'hr.dashboard.checkOut' | translate" size="md" [confirm]="false" /></div>
    <div class="text-muted mb-2" style="font-size:13px">{{ summary() }}</div>
    <div class="field-label">{{ 'hr.dashboard.myBalances' | translate }}</div>
    <div class="d-flex flex-wrap gap-2">@for (b of bal.data() ?? []; track b.leaveTypeId) { <span class="rounded-2 px-2 py-1" style="font-size:12px;background:var(--hr-primary-soft)"><strong>{{ b.leaveTypeName }}</strong> {{ b.available }}</span> }</div></app-card>`,
  styles: [`:host { display: block; height: 100%; } :host ::ng-deep .hr-card { height: 100%; }`],
})
export class DashMyDayComponent {
  private lang = inject(LanguageService);
  today = injectOp<any>('attendance.today'); bal = injectOp<any[]>('leave.mine');
  a = computed(() => this.today.data());
  summary = computed(() => { const a = this.a(); if (!a?.checkIn) return '—'; const m = a.workedMinutes ?? 0; return `${this.lang.time(a.checkIn)} → ${this.lang.time(a.checkOut)} · ${Math.floor(m / 60)}h ${m % 60}m`; });
}
