import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { injectOp } from '../../api/queries/op-query';
import { PermissionService } from '../../core/services/permission.service';
import { CalendarComponent, expandRange, type CalEvent } from '../../shared/components/calendar.component';
import { ModalComponent } from '../../shared/components/modal.component';
import { EmployeeNameComponent } from '../../shared/components/employee.components';
import { RefService } from '../../shared/components/ref.service';
import { SafeHtmlComponent } from '../../shared/components/safe-html.component';
import { CardComponent, ErrorStateComponent, PageHeaderComponent, TabDirective, TabsComponent } from '../../shared/components/ui.components';
import { CrudSectionComponent } from '../../shared/op/crud-section.component';
import { OpButtonComponent } from '../../shared/op/op-button.component';
import { OpViewComponent } from '../../shared/op/op-view.component';
import { FmtDateTimePipe } from '../../shared/pipes/format.pipes';
import { type Col } from '../../shared/tables/data-table.component';
import { OpTableComponent } from '../../shared/tables/op-table.component';

const APP_COLS: Col[] = [
  { key: 'employeeName', hidden: true }, { key: 'leaveTypeName' }, { key: 'fromDate', sortable: true }, { key: 'toDate' }, { key: 'days' }, { key: 'reason' }, { key: 'stage', hidden: true }, { key: 'status', sortable: true }, { key: 'appliedAt', hidden: true },
];

@Component({
  selector: 'app-leave-detail', standalone: true, changeDetection: ChangeDetectionStrategy.Default, imports: [ModalComponent, OpViewComponent, OpButtonComponent, EmployeeNameComponent, SafeHtmlComponent, FmtDateTimePipe, TranslateModule],
  template: `<app-modal [open]="true" title="Leave application" size="lg" (closed)="closed.emit()">
    <app-op-view op="leave.get" [path]="{ id: id() }" [bare]="true" [hide]="['attachments']" />
    <div class="mt-3"><div class="field-label">Approval trail</div><app-op-view op="leave.approvals" [path]="{ id: id() }" [bare]="true" /></div>
    <div class="mt-3"><div class="d-flex justify-content-between"><div class="field-label">{{ 'common.comments' | translate }}</div><app-op-button op="leave.addComment" [path]="{ id: id() }" [label]="'common.add' | translate" [overrides]="{ comment: { rich: true } }" /></div>
      <app-op-view op="leave.comments" [path]="{ id: id() }" [bare]="true"><ng-template let-d>
        @for (c of d; track c.id) { <div class="mb-2 rounded-2 p-2" style="background:var(--hr-surface-2)"><div class="text-muted" style="font-size:12px"><app-employee-name [id]="c.authorEmployeeId ?? c.employeeId" /> · {{ c.createdAt | fmtDateTime }}</div><app-safe-html [html]="c.comment ?? c.body ?? c.text" /></div> } @empty { <div class="text-muted" style="font-size:12px">—</div> }</ng-template></app-op-view></div>
  </app-modal>`,
})
export class LeaveDetailComponent { id = input.required<string>(); closed = output<void>(); }

@Component({
  selector: 'app-my-leave', standalone: true, changeDetection: ChangeDetectionStrategy.Default,
  imports: [FormsModule, TranslateModule, CardComponent, ErrorStateComponent, OpButtonComponent, OpTableComponent, LeaveDetailComponent],
  template: `<div class="d-grid gap-3">
    <app-card [title]="('hr.leave.balance' | translate) + ' · ' + year"><span actions><app-op-button op="leave.apply" [label]="'hr.leave.apply' | translate" icon="pi-calendar-plus" variant="primary" [overrides]="rich" dialogSize="lg" /></span>
      @if (bal.isError()) { <app-error-state [error]="bal.error()" /> } @else { <div class="row g-3">@for (b of bal.data() ?? []; track b.leaveTypeId) {
        <div class="col-6 col-md-4 col-xl-3"><div class="rounded-3 p-3 h-100" style="border:1px solid var(--hr-border)"><div class="text-muted" style="font-size:12px">{{ b.leaveTypeName }}</div><div class="fs-3 fw-bold">{{ b.available }}</div>
          <div class="text-muted" style="font-size:11px">Entitled {{ entitled(b) }} · Used {{ b.used }} · Pending {{ b.pending }}@if (b.encashed) { · Encashed {{ b.encashed }} }</div></div></div> } @empty { <div class="text-muted">—</div> }</div> }</app-card>
    <app-op-table op="leave.mineLeaveApplications" tableId="my-leaves" [columns]="cols" [sortable]="['fromDate', 'status']" defaultSort="fromDate,desc" [query]="{ status: status() }" [rowClickable]="true" (rowClick)="detail.set($event.id)" [rowActions]="acts">
      <select filters class="form-select" style="width:auto" [ngModel]="status()" (ngModelChange)="status.set($event)" [attr.aria-label]="'common.status' | translate"><option value="">{{ 'common.all' | translate }}</option>@for (s of statuses; track s) { <option>{{ s }}</option> }</select></app-op-table>
    <ng-template #acts let-r>
      @if (r.status === 'PENDING') { <app-op-button op="leave.update" [path]="{ id: r.id }" [initial]="r" variant="ghost" [label]="'common.edit' | translate" [overrides]="rich" /><app-op-button op="leave.withdraw" [path]="{ id: r.id }" variant="ghost" label="Withdraw" /> }
      @if (r.status === 'APPROVED') { <app-op-button op="leave.cancel" [path]="{ id: r.id }" variant="ghost" [label]="'common.cancel' | translate" [overrides]="{ reason: { textarea: true } }" /> }</ng-template>
    @if (detail(); as d) { <app-leave-detail [id]="d" (closed)="detail.set(null)" /> }</div>`,
})
export class MyLeaveComponent {
  year = new Date().getFullYear(); cols = APP_COLS; rich = { reason: { textarea: true } }; statuses = ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'WITHDRAWN'];
  status = signal(''); detail = signal<string | null>(null);
  bal = injectOp<any[]>('leave.mine', () => ({ query: { year: this.year } }));
  entitled = (b: any) => Number(b.opening ?? 0) + Number(b.accrued ?? 0) + Number(b.carriedForward ?? 0) + Number(b.adjusted ?? 0);
}

@Component({
  selector: 'app-leave-calendar', standalone: true, changeDetection: ChangeDetectionStrategy.Default, imports: [FormsModule, TranslateModule, CalendarComponent, OpViewComponent],
  template: `<app-calendar [events]="events()" (rangeChange)="range.set($event)">
      @if (perm.canCall('leave.teamCalendar')) { <select class="form-select" style="width:auto" [ngModel]="scope()" (ngModelChange)="scope.set($event)" aria-label="scope"><option value="me">{{ 'nav.myWorkspace' | translate }}</option><option value="team">Team</option></select> }
      @if (team()) { <select class="form-select" style="width:auto" [ngModel]="dept()" (ngModelChange)="dept.set($event)" [attr.aria-label]="'common.department' | translate"><option value="">{{ 'common.all' | translate }}</option>@for (d of deps(); track d.value) { <option [value]="d.value">{{ d.label }}</option> }</select> }
    </app-calendar>
    @if (perm.canCall('leave.upcoming')) { <div class="mt-3"><app-op-view op="leave.upcoming" [query]="{ days: 30 }" title="Upcoming leave (30 days)" /></div> }`,
})
export class LeaveCalendarComponent {
  perm = inject(PermissionService); private refs = inject(RefService);
  range = signal({ from: '', to: '' }); dept = signal(''); scope = signal<'me' | 'team'>('me'); deps = this.refs.options('department');
  team = computed(() => this.scope() === 'team' && this.perm.canCall('leave.teamCalendar'));
  mine = injectOp<any[]>('leave.myCalendar', () => ({ query: { from: this.range().from, to: this.range().to } }), () => ({ enabled: !!this.range().from && !this.team() && this.perm.canCall('leave.myCalendar') }));
  tm = injectOp<any[]>('leave.teamCalendar', () => ({ query: { from: this.range().from, to: this.range().to, departmentId: this.dept() || undefined } }), () => ({ enabled: !!this.range().from && this.team() }));
  hol = injectOp<any[]>('holiday.range', () => ({ query: { from: this.range().from, to: this.range().to } }), () => ({ enabled: !!this.range().from }));
  events = computed<CalEvent[]>(() => {
    const team = this.team(); const rows = (team ? this.tm.data() : this.mine.data()) ?? [];
    return [
      ...rows.flatMap((e: any) => expandRange(e.fromDate, e.toDate, () => ({ label: `${team ? e.employeeName + ' · ' : ''}${e.leaveTypeName}`, title: `${e.employeeName} ${e.leaveTypeName} (${e.status})`, tone: e.status === 'APPROVED' ? 'success' as const : e.status === 'PENDING' ? 'warning' as const : 'neutral' as const }))),
      ...(this.hol.data() ?? []).map((h: any) => ({ date: h.holidayDate, label: `★ ${h.name}`, tone: 'info' as const })),
    ];
  });
}

@Component({
  selector: 'app-leave-approvals', standalone: true, changeDetection: ChangeDetectionStrategy.Default, imports: [TranslateModule, CardComponent, OpTableComponent, OpButtonComponent],
  template: `<div class="d-grid gap-3">
    <app-card [title]="'hr.leave.approvals' | translate"><app-op-table op="leave.pending" tableId="leave-pending" [columns]="cols" [rowActions]="act" /></app-card>
    <app-card title="Cancellation requests"><app-op-table op="leave.cancellationRequests" tableId="leave-cancel" [columns]="cols" [rowActions]="cancelAct" /></app-card></div>
    <ng-template #act let-r><app-op-button op="leave.approve" [path]="{ id: r.id }" [label]="'common.approve' | translate" icon="pi-check" variant="success" [overrides]="dec" /><app-op-button op="leave.reject" [path]="{ id: r.id }" [label]="'common.reject' | translate" icon="pi-times" variant="danger" [overrides]="dec" /></ng-template>
    <ng-template #cancelAct let-r><app-op-button op="leave.approveCancellation" [path]="{ id: r.id }" [label]="'common.approve' | translate" variant="success" [overrides]="dec" /><app-op-button op="leave.rejectCancellation" [path]="{ id: r.id }" [label]="'common.reject' | translate" variant="danger" [overrides]="dec" /></ng-template>`,
})
export class LeaveApprovalsComponent { cols = APP_COLS; dec = { comment: { rich: true } }; }

@Component({
  selector: 'app-leave-policy', standalone: true, changeDetection: ChangeDetectionStrategy.Default, imports: [CrudSectionComponent],
  template: `<div class="d-grid gap-3">
    <app-crud-section title="Leave types" [list]="{ op: 'leave.types' }" [create]="{ op: 'leave.createType' }" [update]="{ op: 'leave.updateType', path: idPath }" [remove]="{ op: 'leave.deleteType', path: idPath }" dialogSize="lg" />
    <app-crud-section title="Leave policies" [list]="{ op: 'leave.policies' }" [create]="{ op: 'leave.createPolicy' }" [update]="{ op: 'leave.updatePolicy', path: idPath }" [view]="{ op: 'leave.policy', path: idPath }" dialogSize="xl" /></div>`,
})
export class LeavePolicyComponent { idPath = (r: any) => ({ id: r.id }); }

@Component({
  selector: 'app-leave-admin', standalone: true, changeDetection: ChangeDetectionStrategy.Default, imports: [FormsModule, CardComponent, OpButtonComponent, OpViewComponent],
  template: `<div class="d-grid gap-3">
    <app-card title="Batch jobs"><div class="d-flex flex-wrap gap-2"><app-op-button op="leave.accrue" label="Run monthly accrual" variant="outline" size="md" /><app-op-button op="leave.carryForward" label="Run year-end carry-forward" variant="outline" size="md" /></div></app-card>
    <app-card title="Employee balance tools">
      <div class="d-flex flex-wrap gap-2 align-items-end mb-3"><div style="min-width:260px"><div class="field-label">Employee id</div><input class="form-control" [ngModel]="emp()" (ngModelChange)="emp.set($event.trim())" placeholder="employee UUID (see Employees)" /></div>
        @if (emp()) { <app-op-button op="leave.adjust" [path]="{ employeeId: emp() }" label="Adjust balance" size="md" /><app-op-button op="leave.encash" [path]="{ employeeId: emp() }" label="Encash" size="md" /> }</div>
      @if (emp()) { <app-op-view op="leave.encashable" [path]="{ employeeId: emp() }" title="Encashable" /><div class="mt-3"><app-op-view op="leave.reconcile" [path]="{ employeeId: emp() }" title="Reconciliation" /></div> }</app-card>
    <app-card title="Unpaid days (for payroll)"><app-op-view op="leave.unpaid" [bare]="true" /></app-card></div>`,
})
export class LeaveAdminComponent { emp = signal(''); }

@Component({
  selector: 'app-leave-page', standalone: true, changeDetection: ChangeDetectionStrategy.Default,
  imports: [TranslateModule, PageHeaderComponent, TabsComponent, TabDirective, MyLeaveComponent, LeaveCalendarComponent, LeaveApprovalsComponent, LeavePolicyComponent, LeaveAdminComponent],
  template: `<app-page-header [title]="'hr.leave.title' | translate" [subtitle]="'hr.leave.sub' | translate" />
  <app-tabs>
    <ng-template appTab="mine" [label]="'nav.myWorkspace' | translate" [hidden]="!self()"><app-my-leave /></ng-template>
    <ng-template appTab="calendar" [label]="'hr.leave.calendar' | translate"><app-leave-calendar /></ng-template>
    <ng-template appTab="approvals" [label]="'hr.leave.approvals' | translate" [hidden]="!perm.canCall('leave.pending')"><app-leave-approvals /></ng-template>
    <ng-template appTab="policy" [label]="'hr.leave.policy' | translate"><app-leave-policy /></ng-template>
    <ng-template appTab="admin" [label]="'hr.leave.admin' | translate" [hidden]="!perm.isAdmin()"><app-leave-admin /></ng-template>
  </app-tabs>`,
})
export class LeavePage { perm = inject(PermissionService); self = computed(() => !!this.perm.user()?.employeeId); }
export default LeavePage;
