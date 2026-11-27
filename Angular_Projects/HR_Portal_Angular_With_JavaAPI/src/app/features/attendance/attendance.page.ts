import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { injectOp } from '../../api/queries/op-query';
import { LanguageService } from '../../core/services/language.service';
import { PermissionService } from '../../core/services/permission.service';
import { ChartCardComponent } from '../../shared/charts/chart-card.component';
import { barOption } from '../../shared/charts/chart-options';
import { CalendarComponent, type CalEvent } from '../../shared/components/calendar.component';
import { CardComponent, LoadingBlockComponent, PageHeaderComponent, TabDirective, TabsComponent } from '../../shared/components/ui.components';
import { DetailComponent, StatusBadgeComponent } from '../../shared/components/value.components';
import { CrudSectionComponent } from '../../shared/op/crud-section.component';
import { OpButtonComponent } from '../../shared/op/op-button.component';
import { DataTableComponent, type Col } from '../../shared/tables/data-table.component';
import { OpTableComponent } from '../../shared/tables/op-table.component';
import { isoDate, monthStr, parseDate } from '../../shared/utilities/date';

const hm = (m?: number | null) => (m == null ? '—' : `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`);
const DEC = { comment: { rich: true } };
const TONE: Record<string, CalEvent['tone']> = { PRESENT: 'success', ABSENT: 'danger', HALF_DAY: 'warning', MISSING_PUNCH: 'warning', WEEKLY_OFF: 'neutral', HOLIDAY: 'info', LEAVE: 'info', ON_LEAVE: 'info', WFH: 'info' };
const MIN = (v: any) => hm(v);

@Component({
  selector: 'app-att-today', standalone: true, changeDetection: ChangeDetectionStrategy.Default, imports: [TranslateModule, CardComponent, StatusBadgeComponent, OpButtonComponent],
  template: `<app-card [title]="('common.today' | translate) + ' · ' + lang.date(today)"><span actions><app-status-badge [value]="a()?.status" /></span>
    <div class="d-flex flex-wrap align-items-center gap-4">
      <div><div class="field-label m-0">{{ 'fields.checkIn' | translate }}</div><div class="fs-4 fw-bold">{{ lang.time(a()?.checkIn) }}</div></div>
      <div><div class="field-label m-0">{{ 'fields.checkOut' | translate }}</div><div class="fs-4 fw-bold">{{ lang.time(a()?.checkOut) }}</div></div>
      <div><div class="field-label m-0">{{ 'hr.dashboard.workedToday' | translate }}</div><div class="fs-4 fw-bold">{{ hm(a()?.workedMinutes) }}</div></div>
      <div class="ms-auto d-flex gap-2"><app-op-button op="attendance.checkIn" [label]="'hr.dashboard.checkIn' | translate" icon="pi-sign-in" variant="primary" size="md" /><app-op-button op="attendance.checkOut" [label]="'hr.dashboard.checkOut' | translate" icon="pi-sign-out" size="md" [confirm]="false" /></div></div></app-card>`,
})
export class AttTodayComponent { lang = inject(LanguageService); today = isoDate(new Date()); hm = hm; q = injectOp<any>('attendance.today'); a = computed(() => this.q.data()); }

@Component({
  selector: 'app-my-attendance', standalone: true, changeDetection: ChangeDetectionStrategy.Default,
  imports: [FormsModule, TranslateModule, CardComponent, AttTodayComponent, CalendarComponent, DataTableComponent, DetailComponent, LoadingBlockComponent],
  template: `<div class="d-grid gap-3"><app-att-today />
    <div class="d-flex gap-2 align-items-center"><input type="month" class="form-control" style="width:auto" [ngModel]="month()" (ngModelChange)="$event && month.set($event)" [attr.aria-label]="'common.month' | translate" /></div>
    <app-card [title]="('common.summary' | translate) + ' · ' + month()">@if (summary.isLoading()) { <app-loading-block [rows]="2" /> } @else { <app-detail [data]="summary.data()" [hide]="['employeeId','generatedAt','year']" /> }</app-card>
    @for (m of [month()]; track m) { <app-calendar [initial]="initial()" [events]="events()" /> }
    <app-data-table id="my-attendance" [rows]="rec.data() ?? []" [loading]="rec.isLoading()" [error]="rec.error()" [columns]="cols" /></div>`,
})
export class MyAttendanceComponent {
  month = signal(monthStr()); initial = computed(() => parseDate(this.month() + '-01'));
  cal = injectOp<any[]>('attendance.myCalendar', () => ({ query: { month: this.month() } }));
  rec = injectOp<any[]>('attendance.mine', () => { const d = this.initial(); return { query: { from: isoDate(new Date(d.getFullYear(), d.getMonth(), 1)), to: isoDate(new Date(d.getFullYear(), d.getMonth() + 1, 0)) } }; });
  summary = injectOp<any>('attendance.myMonthly', () => ({ query: { month: this.month() } }));
  events = computed<CalEvent[]>(() => (this.cal.data() ?? []).filter((d) => d.type !== 'NO_RECORD').map((d) => ({ date: d.date, label: `${d.type.replace(/_/g, ' ')}${d.workedMinutes ? ' · ' + hm(d.workedMinutes) : ''}`, tone: TONE[d.type] ?? 'primary' })));
  cols: Col[] = [{ key: 'workDate', sortable: true }, { key: 'checkIn' }, { key: 'checkOut' }, { key: 'workedMinutes', fmt: MIN }, { key: 'lateMinutes' }, { key: 'earlyDepartureMinutes', hidden: true }, { key: 'overtimeMinutes', hidden: true }, { key: 'workMode' }, { key: 'status' }, { key: 'remarks', hidden: true }];
}

@Component({
  selector: 'app-att-requests', standalone: true, changeDetection: ChangeDetectionStrategy.Default, imports: [CrudSectionComponent, OpButtonComponent, TranslateModule],
  template: `<div class="d-grid gap-3">
    <app-crud-section title="Regularization / corrections" [list]="{ op: 'attendance.myCorrections' }" [create]="{ op: 'attendance.requestCorrection' }" [extraRowActions]="corr" />
    <app-crud-section title="Work from home" [list]="{ op: 'attendance.myWfh' }" [create]="{ op: 'attendance.requestWfh' }" [extraRowActions]="wfh" /></div>
    <ng-template #corr let-r>@if (r.status === 'PENDING') { <app-op-button op="attendance.cancelCorrection" [path]="{ id: r.id }" variant="ghost" [label]="'common.cancel' | translate" /> }</ng-template>
    <ng-template #wfh let-r>@if (r.status === 'PENDING') { <app-op-button op="attendance.cancelWfh" [path]="{ id: r.id }" variant="ghost" [label]="'common.cancel' | translate" /> }</ng-template>`,
})
export class AttRequestsComponent {}

@Component({
  selector: 'app-att-team', standalone: true, changeDetection: ChangeDetectionStrategy.Default,
  imports: [FormsModule, TranslateModule, CardComponent, ChartCardComponent, DataTableComponent, OpTableComponent],
  template: `<div class="d-grid gap-3"><div class="row g-3">
      <div class="col-12 col-xl-5"><app-chart-card [title]="'Status · ' + date()" [loading]="daily.isLoading()" [error]="daily.error()" [empty]="!counts().length" [build]="build" /></div>
      <div class="col-12 col-xl-7"><app-card [title]="'common.day' | translate"><input actions type="date" class="form-control" style="width:auto" [ngModel]="date()" (ngModelChange)="date.set($event)" />
        <app-data-table id="att-daily" [rows]="daily.data() ?? []" [loading]="daily.isLoading()" [error]="daily.error()" [columns]="dailyCols" /></app-card></div></div>
    <app-card title="Team monthly report"><input actions type="month" class="form-control" style="width:auto" [ngModel]="month()" (ngModelChange)="$event && month.set($event)" />
      <app-op-table op="attendance.teamReport" [query]="{ month: month() }" tableId="att-team" [columns]="teamCols" /></app-card></div>`,
})
export class AttTeamComponent {
  tr = inject(LanguageService); date = signal(isoDate(new Date())); month = signal(monthStr());
  daily = injectOp<any[]>('attendance.daily', () => ({ query: { date: this.date() } }));
  counts = computed(() => Object.entries((this.daily.data() ?? []).reduce((a: any, r) => ({ ...a, [r.status]: (a[r.status] ?? 0) + 1 }), {})).map(([name, count]) => ({ name, count })));
  build = (dark: boolean) => barOption(dark, this.counts(), 'name', [{ key: 'count', label: 'Total' }]);
  dailyCols: Col[] = [{ key: 'employeeName' }, { key: 'status' }, { key: 'checkIn' }, { key: 'checkOut' }, { key: 'workedMinutes', fmt: MIN }, { key: 'lateMinutes' }, { key: 'workMode' }];
  teamCols: Col[] = [{ key: 'employeeId' }, { key: 'presentDays' }, { key: 'halfDays' }, { key: 'absentDays' }, { key: 'leaveDays' }, { key: 'wfhDays' }, { key: 'lateCount' }, { key: 'missingPunches' }, { key: 'workedMinutes', fmt: MIN }];
}

@Component({
  selector: 'app-att-approvals', standalone: true, changeDetection: ChangeDetectionStrategy.Default, imports: [TranslateModule, CardComponent, OpTableComponent, OpButtonComponent],
  template: `<div class="d-grid gap-3"><app-card title="Pending corrections"><app-op-table op="attendance.pendingCorrections" tableId="att-corr" [rowActions]="corr" /></app-card>
    <app-card title="Pending work-from-home"><app-op-table op="attendance.pendingWfh" tableId="att-wfh" [rowActions]="wfh" /></app-card></div>
    <ng-template #corr let-r><app-op-button op="attendance.approveCorrection" [path]="{ id: r.id }" [label]="'common.approve' | translate" icon="pi-check" variant="success" [overrides]="dec" /><app-op-button op="attendance.rejectCorrection" [path]="{ id: r.id }" [label]="'common.reject' | translate" icon="pi-times" variant="danger" [overrides]="dec" /></ng-template>
    <ng-template #wfh let-r><app-op-button op="attendance.approveWfh" [path]="{ id: r.id }" [label]="'common.approve' | translate" variant="success" [overrides]="dec" /><app-op-button op="attendance.rejectWfh" [path]="{ id: r.id }" [label]="'common.reject' | translate" variant="danger" [overrides]="dec" /></ng-template>`,
})
export class AttApprovalsComponent { dec = DEC; }

@Component({
  selector: 'app-att-admin', standalone: true, changeDetection: ChangeDetectionStrategy.Default, imports: [CrudSectionComponent, CardComponent, OpButtonComponent],
  template: `<div class="d-grid gap-3"><app-crud-section title="Shifts" [list]="{ op: 'attendance.shifts' }" [create]="{ op: 'attendance.createShift' }" [update]="{ op: 'attendance.updateShift', path: idp }" [remove]="{ op: 'attendance.deleteShift', path: idp }" [extraRowActions]="assign" />
    <app-card title="Batch operations"><div class="d-flex gap-2 flex-wrap"><app-op-button op="attendance.importPunches" label="Import punches" size="md" dialogSize="lg" /><app-op-button op="attendance.runMissingPunchJob" label="Run missing-punch job" size="md" /></div></app-card></div>
    <ng-template #assign let-r><app-op-button op="attendance.assign" [path]="{ id: r.id }" label="Assign" variant="ghost" /></ng-template>`,
})
export class AttAdminComponent { idp = (r: any) => ({ id: r.id }); }

@Component({
  selector: 'app-attendance-page', standalone: true, changeDetection: ChangeDetectionStrategy.Default,
  imports: [TranslateModule, PageHeaderComponent, TabsComponent, TabDirective, MyAttendanceComponent, AttRequestsComponent, AttTeamComponent, AttApprovalsComponent, AttAdminComponent],
  template: `<app-page-header [title]="'hr.attendance.title' | translate" [subtitle]="'hr.attendance.sub' | translate" />
  <app-tabs>
    <ng-template appTab="mine" [label]="'nav.myWorkspace' | translate" [hidden]="!self()"><app-my-attendance /></ng-template>
    <ng-template appTab="requests" label="Corrections & WFH" [hidden]="!self()"><app-att-requests /></ng-template>
    <ng-template appTab="team" label="Team & daily" [hidden]="!perm.canCall('attendance.daily')"><app-att-team /></ng-template>
    <ng-template appTab="approvals" [label]="'hr.leave.approvals' | translate" [hidden]="!perm.canCall('attendance.pendingCorrections')"><app-att-approvals /></ng-template>
    <ng-template appTab="admin" [label]="'hr.leave.admin' | translate" [hidden]="!perm.canCall('attendance.createShift')"><app-att-admin /></ng-template>
  </app-tabs>
  @if (!self() && !perm.canCall('attendance.daily')) { <div class="mt-3 text-muted">{{ 'common.notAuthorized' | translate }}</div> }`,
})
export class AttendancePage { perm = inject(PermissionService); self = computed(() => !!this.perm.user()?.employeeId); }
export default AttendancePage;
