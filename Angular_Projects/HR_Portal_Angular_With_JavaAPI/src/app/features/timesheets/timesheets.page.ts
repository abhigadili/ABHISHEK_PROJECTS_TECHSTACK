import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { injectOp } from '../../api/queries/op-query';
import { PermissionService } from '../../core/services/permission.service';
import { CalendarComponent, type CalEvent } from '../../shared/components/calendar.component';
import { EmployeeNameComponent } from '../../shared/components/employee.components';
import { ModalComponent } from '../../shared/components/modal.component';
import { RefService } from '../../shared/components/ref.service';
import { CardComponent, LoadingBlockComponent, PageHeaderComponent, TabDirective, TabsComponent } from '../../shared/components/ui.components';
import { DetailComponent } from '../../shared/components/value.components';
import { CrudSectionComponent } from '../../shared/op/crud-section.component';
import { EmployeeScopeComponent } from '../../shared/op/employee-scope.component';
import { OpButtonComponent } from '../../shared/op/op-button.component';
import { OpViewComponent } from '../../shared/op/op-view.component';
import { DataTableComponent, type Col } from '../../shared/tables/data-table.component';
import { OpTableComponent } from '../../shared/tables/op-table.component';
import { isoDate, monthStr, parseDate } from '../../shared/utilities/date';
import { WeeklyGridComponent } from './weekly-grid.component';

const DEC = { comment: { rich: true } };

@Component({
  selector: 'app-sheet-detail', standalone: true, changeDetection: ChangeDetectionStrategy.Default,
  imports: [ModalComponent, DetailComponent, DataTableComponent, OpViewComponent, OpButtonComponent, LoadingBlockComponent, EmployeeNameComponent],
  template: `<app-modal [open]="true" [title]="'Timesheet · ' + (d()?.weekStart ?? '')" size="xl" (closed)="closed.emit()">
    @if (q.isLoading()) { <app-loading-block /> }
    @if (d(); as d) { <div class="d-grid gap-3"><app-detail [data]="d" [hide]="['id', 'entries']" /><div>Approver: <app-employee-name [id]="d.approverId" /></div><app-data-table id="ts-entries" [rows]="d.entries ?? []" /><app-op-view op="timesheet.history" [path]="{ id: id() }" title="History" /></div> }
    <ng-container footer>@if (d(); as d) { @if (perm.canCall('timesheet.approve')) {
      @if (d.status === 'SUBMITTED') { <app-op-button op="timesheet.approve" [path]="{ id: id() }" label="Approve" icon="pi-check" variant="success" size="md" [overrides]="dec" /><app-op-button op="timesheet.reject" [path]="{ id: id() }" label="Reject" icon="pi-times" variant="danger" size="md" [overrides]="dec" /> }
      @if (d.status === 'APPROVED') { <app-op-button op="timesheet.reopen" [path]="{ id: id() }" label="Reopen" icon="pi-replay" size="md" /> } } }</ng-container></app-modal>`,
})
export class SheetDetailComponent {
  perm = inject(PermissionService); dec = DEC; id = input.required<string>(); closed = output<void>();
  q = injectOp<any>('timesheet.get', () => ({ path: { id: this.id() } })); d = computed(() => this.q.data());
}

@Component({
  selector: 'app-ts-history', standalone: true, changeDetection: ChangeDetectionStrategy.Default, imports: [FormsModule, CardComponent, CalendarComponent, OpTableComponent, SheetDetailComponent],
  template: `<div class="d-grid gap-3"><div class="d-flex align-items-center gap-3"><input type="month" class="form-control" style="width:auto" [ngModel]="month()" (ngModelChange)="$event && month.set($event)" /><span class="text-muted">Monthly total: <strong>{{ total().toFixed(1) }} h</strong></span></div>
    @for (m of [month()]; track m) { <app-calendar [initial]="initial()" [events]="events()" /> }
    <app-card title="Timesheets"><app-op-table op="timesheet.mine" [query]="{ from: from(), to: to() }" tableId="ts-mine" [rowClickable]="true" (rowClick)="open.set($event.id)" [columns]="cols" /></app-card>
    @if (open(); as o) { <app-sheet-detail [id]="o" (closed)="open.set(null)" /> }</div>`,
})
export class TsHistoryComponent {
  month = signal(monthStr()); open = signal<string | null>(null); initial = computed(() => parseDate(this.month() + '-01'));
  from = computed(() => isoDate(this.initial())); to = computed(() => { const d = this.initial(); return isoDate(new Date(d.getFullYear(), d.getMonth() + 1, 0)); });
  q = injectOp<any>('timesheet.mine', () => ({ query: { from: this.from(), to: this.to(), size: 100 } }));
  byDay = computed(() => { const m = new Map<string, number>(); (this.q.data()?.content ?? []).forEach((s: any) => (s.entries ?? []).forEach((e: any) => m.set(e.workDate, (m.get(e.workDate) ?? 0) + Number(e.hours)))); return m; });
  events = computed<CalEvent[]>(() => [...this.byDay()].map(([date, h]) => ({ date, label: `${h.toFixed(1)} h`, tone: h >= 8 ? 'success' as const : 'warning' as const })));
  total = computed(() => [...this.byDay().values()].reduce((a, b) => a + b, 0));
  cols: Col[] = [{ key: 'weekStart' }, { key: 'status' }, { key: 'totalHours' }, { key: 'billableHours' }, { key: 'submittedAt', hidden: true }, { key: 'decisionComment', hidden: true }];
}

@Component({
  selector: 'app-ts-approvals', standalone: true, changeDetection: ChangeDetectionStrategy.Default, imports: [CardComponent, OpTableComponent, OpButtonComponent, SheetDetailComponent],
  template: `<app-card title="Timesheets awaiting approval"><app-op-table op="timesheet.pending" tableId="ts-pending" [rowClickable]="true" (rowClick)="open.set($event.id)" [columns]="cols" [rowActions]="acts" /></app-card>@if (open(); as o) { <app-sheet-detail [id]="o" (closed)="open.set(null)" /> }
    <ng-template #acts let-r><app-op-button op="timesheet.approve" [path]="{ id: r.id }" label="Approve" variant="success" [overrides]="dec" icon="pi-check" /><app-op-button op="timesheet.reject" [path]="{ id: r.id }" label="Reject" variant="danger" [overrides]="dec" icon="pi-times" /></ng-template>`,
})
export class TsApprovalsComponent { open = signal<string | null>(null); dec = DEC; cols: Col[] = [{ key: 'employeeName' }, { key: 'weekStart' }, { key: 'totalHours' }, { key: 'billableHours' }, { key: 'status' }]; }

@Component({
  selector: 'app-ts-tasks', standalone: true, changeDetection: ChangeDetectionStrategy.Default, imports: [FormsModule, CrudSectionComponent],
  template: `<select class="form-select mb-3" style="width:auto" [ngModel]="project()" (ngModelChange)="pid.set($event)" aria-label="project">@for (o of projects(); track o.value) { <option [value]="o.value">{{ o.label }}</option> }</select>
    @if (project()) { <app-crud-section title="Project tasks" [list]="{ op: 'timesheet.tasks', query: { projectId: project() } }" [create]="{ op: 'timesheet.createTask', initial: { projectId: project() } }" [update]="{ op: 'timesheet.updateTask', path: idp }" /> }`,
})
export class TsTasksComponent { projects = inject(RefService).options('project'); pid = signal(''); project = computed(() => this.pid() || this.projects()[0]?.value || ''); idp = (r: any) => ({ id: r.id }); }

@Component({
  selector: 'app-timesheets-page', standalone: true, changeDetection: ChangeDetectionStrategy.Default,
  imports: [TranslateModule, PageHeaderComponent, TabsComponent, TabDirective, WeeklyGridComponent, TsHistoryComponent, TsApprovalsComponent, TsTasksComponent, EmployeeScopeComponent, OpViewComponent, OpTableComponent],
  template: `<app-page-header [title]="'hr.timesheets.title' | translate" [subtitle]="'hr.timesheets.sub' | translate" />
  <app-tabs>
    <ng-template appTab="week" label="Weekly grid" [hidden]="!self()"><app-weekly-grid /></ng-template>
    <ng-template appTab="history" label="History & calendar" [hidden]="!self()"><app-ts-history /></ng-template>
    <ng-template appTab="approvals" [label]="'hr.leave.approvals' | translate" [hidden]="!perm.canCall('timesheet.pending')"><app-ts-approvals /></ng-template>
    <ng-template appTab="tasks" label="Tasks" [hidden]="!perm.canCall('timesheet.createTask') && !perm.isManager()"><app-ts-tasks /></ng-template>
    <ng-template appTab="reports" [label]="'nav.reports' | translate" [hidden]="!perm.isManager()"><app-employee-scope><ng-template let-id><div class="d-grid gap-3"><app-op-view op="timesheet.employee" [path]="{ employeeId: id }" title="Hours summary" /><app-op-table op="timesheet.forEmployee" [path]="{ employeeId: id }" tableId="ts-emp" /></div></ng-template></app-employee-scope></ng-template>
  </app-tabs>`,
})
export class TimesheetsPage { perm = inject(PermissionService); self = computed(() => !!this.perm.user()?.employeeId); }
export default TimesheetsPage;
