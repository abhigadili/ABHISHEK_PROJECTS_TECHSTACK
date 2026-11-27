import { ChangeDetectionStrategy, Component, computed, effect, inject, input, untracked } from '@angular/core';
import { Store } from '@ngrx/store';
import { TranslateModule } from '@ngx-translate/core';
import { injectOp } from '../../api/queries/op-query';
import { PermissionService } from '../../core/services/permission.service';
import { CardComponent, ErrorStateComponent, LoadingBlockComponent, SubComponent, TabDirective, TabsComponent } from '../../shared/components/ui.components';
import { EmployeeNameComponent } from '../../shared/components/employee.components';
import { RefService } from '../../shared/components/ref.service';
import { DetailComponent, StatusBadgeComponent } from '../../shared/components/value.components';
import { CrudSectionComponent } from '../../shared/op/crud-section.component';
import { OpButtonComponent } from '../../shared/op/op-button.component';
import { OpViewComponent } from '../../shared/op/op-view.component';
import { OpTableComponent } from '../../shared/tables/op-table.component';
import { RecentActions } from '../../state/ngrx/recent.state';
import { financialYear, initials, isoDate, monthStr } from '../../shared/utilities/date';

@Component({
  selector: 'app-employee-profile-page', standalone: true, changeDetection: ChangeDetectionStrategy.Default,
  imports: [TranslateModule, CardComponent, ErrorStateComponent, LoadingBlockComponent, SubComponent, TabsComponent, TabDirective, EmployeeNameComponent, DetailComponent, StatusBadgeComponent, CrudSectionComponent, OpButtonComponent, OpViewComponent, OpTableComponent],
  template: `
  @if (q.isLoading()) { <app-loading-block [rows]="6" /> } @else if (q.isError()) { <app-error-state [error]="q.error()" (retry)="q.refetch()" /> } @else {
  <div class="hr-card mb-3"><div class="hr-card-body d-flex flex-wrap align-items-center gap-3">
    <span class="d-inline-flex align-items-center justify-content-center rounded-circle" style="width:56px;height:56px;font-size:20px;font-weight:600;background:var(--hr-primary);color:rgb(var(--hr-primary-fg-rgb))">{{ ini() }}</span>
    <div class="flex-grow-1"><h1 class="page-title">{{ e().fullName }}</h1>
      <div class="text-muted" style="font-size:13px">{{ e().employeeCode }} · {{ refs.label('designation', e().designationId) }} · {{ refs.label('department', e().departmentId) }} · {{ refs.label('location', e().locationId) }}</div>
      <div class="mt-1 d-flex align-items-center gap-2"><app-status-badge [value]="e().status" /><span class="text-muted" style="font-size:12px">{{ 'common.manager' | translate }}: <app-employee-name [id]="e().managerId" /></span></div></div>
    <div class="d-flex flex-wrap gap-2">
      <app-op-button op="employee.update" [path]="{ id: id() }" [initial]="e()" [label]="'common.edit' | translate" icon="pi-pencil" dialogSize="lg" [overrides]="{ status: { hidden: true } }" />
      <app-op-button op="employee.transfer" [path]="{ id: id() }" label="Transfer" icon="pi-arrow-right-arrow-left" />
      <app-op-button op="employee.manager" [path]="{ id: id() }" [label]="'common.manager' | translate" icon="pi-user-edit" />
      <app-op-button op="employee.status" [path]="{ id: id() }" [label]="'common.status' | translate" icon="pi-user-minus" />
      @if (isSelf()) { <app-op-button op="employee.updateMyContact" label="My contact" [initial]="e().contact" /> }</div></div></div>

  <app-tabs>
    <ng-template appTab="overview" [label]="T('overview') | translate"><div class="row g-3">
      <div class="col-12"><app-card><app-detail [data]="e()" [hide]="['id','version','contact','fullName','departmentId','designationId','locationId','managerId']" /></app-card></div>
      @if (e().contact) { <div class="col-12"><app-card><div class="field-label">Contact</div><app-detail [data]="e().contact" /></app-card></div> }
      <div class="col-12"><app-op-view op="employee.summary" [path]="{ id: id() }" title="Summary" /></div></div></ng-template>
    <ng-template appTab="job" [label]="T('job') | translate">
      <app-sub title="Employment history"><app-op-view op="employee.employmentHistory" [path]="path()" [bare]="true" /></app-sub>
      <app-sub title="Status history"><app-op-view op="employee.statusHistory" [path]="path()" [bare]="true" /></app-sub>
      <app-sub title="Reporting chain"><app-op-view op="organization.chain" [path]="path()" [bare]="true" /></app-sub></ng-template>
    <ng-template appTab="contact" [label]="T('contact') | translate"><div class="d-grid gap-3">
      <app-crud-section title="Addresses" [list]="{ op: 'employee.addresses', path: path() }" [create]="{ op: 'employee.addAddress', path: path() }" [update]="{ op: 'employee.updateAddress', path: rowPath }" [remove]="{ op: 'employee.deleteAddress', path: rowPath }" />
      <app-crud-section title="Emergency contacts" [list]="{ op: 'employee.contacts', path: path() }" [create]="{ op: 'employee.addContact', path: path() }" [update]="{ op: 'employee.updateContact', path: rowPath }" [remove]="{ op: 'employee.deleteContact', path: rowPath }" /></div></ng-template>
    <ng-template appTab="education" [label]="T('education') | translate"><div class="d-grid gap-3">
      <app-crud-section title="Education" [list]="{ op: 'employee.education', path: path() }" [create]="{ op: 'employee.addEducation', path: path() }" [update]="{ op: 'employee.updateEducation', path: rowPath }" [remove]="{ op: 'employee.deleteEducation', path: rowPath }" />
      <app-crud-section title="Experience" [list]="{ op: 'employee.experience', path: path() }" [create]="{ op: 'employee.addExperience', path: path() }" [update]="{ op: 'employee.updateExperience', path: rowPath }" [remove]="{ op: 'employee.deleteExperience', path: rowPath }" /></div></ng-template>
    <ng-template appTab="bank" [label]="T('bank') | translate" [hidden]="!canBank()"><app-op-view op="employee.bank" [path]="path()"><span actions><app-op-button op="employee.saveBank" [path]="path()" [label]="'common.edit' | translate" icon="pi-pencil" /></span></app-op-view></ng-template>
    <ng-template appTab="team" [label]="T('team') | translate">
      <app-sub title="Direct reports"><app-op-view op="employee.team" [path]="{ id: id() }" [bare]="true" /></app-sub>
      <app-sub title="All subordinates"><app-op-view op="organization.subordinates" [path]="path()" [query]="{ depth: 3 }" [bare]="true" /></app-sub></ng-template>
    <ng-template appTab="leave" [label]="T('leave') | translate">
      <app-sub title="Balances"><app-op-view op="leave.of" [path]="path()" [query]="{ year: year }" [bare]="true" /></app-sub>
      <app-sub title="Balance reconciliation"><app-op-view op="leave.reconcile" [path]="path()" [query]="{ year: year }" [bare]="true" /></app-sub>
      <app-sub title="Balance history"><app-op-view op="leave.history" [path]="path()" [query]="{ year: year }" [bare]="true" /></app-sub>
      <app-sub title="Applications"><app-op-table op="leave.forEmployee" [path]="path()" tableId="emp-leave" /></app-sub></ng-template>
    <ng-template appTab="attendance" [label]="T('attendance') | translate">
      <app-sub title="Monthly summary"><app-op-view op="attendance.monthlySummary" [path]="path()" [query]="{ month: month }" [bare]="true" /></app-sub>
      <app-sub title="Attendance this month"><app-op-view op="attendance.of" [path]="path()" [query]="range" [bare]="true" /></app-sub>
      <app-sub title="Calendar"><app-op-view op="attendance.calendarOf" [path]="path()" [query]="{ month: month }" [bare]="true" /></app-sub>
      <app-sub title="Shift assignments"><app-op-view op="attendance.assignments" [path]="path()" [bare]="true" /></app-sub></ng-template>
    <ng-template appTab="timesheets" [label]="T('timesheets') | translate">
      <app-sub title="Timesheets"><app-op-table op="timesheet.forEmployee" [path]="path()" tableId="emp-ts" /></app-sub>
      <app-sub title="Hours summary"><app-op-view op="timesheet.employee" [path]="path()" [bare]="true" /></app-sub></ng-template>
    <ng-template appTab="projects" [label]="T('projects') | translate">
      <app-sub title="Projects"><app-op-view op="project.employeeProjects" [path]="path()" [bare]="true" /></app-sub>
      <app-sub title="Allocation summary"><app-op-view op="project.allocationSummary" [path]="path()" [bare]="true" /></app-sub></ng-template>
    <ng-template appTab="documents" [label]="T('documents') | translate"><app-op-view op="document.forEmployee" [path]="path()" [title]="T('documents') | translate" /></ng-template>
    <ng-template appTab="payroll" [label]="T('payroll') | translate" [hidden]="!canPayroll()">
      <app-sub title="Salary summary"><app-op-view op="payroll.summary" [path]="path()" [bare]="true" /></app-sub>
      <app-sub title="Current salary"><app-op-view op="payroll.salary" [path]="path()" [bare]="true" /></app-sub>
      <app-sub title="Salary history"><app-op-view op="payroll.salaryHistory" [path]="path()" [bare]="true" /></app-sub>
      <app-sub title="Payslips"><app-op-view op="payroll.payslipsOf" [path]="path()" [bare]="true" /></app-sub>
      <app-crud-section title="Loans" [list]="{ op: 'payroll.loans', path: path() }" [create]="{ op: 'payroll.addLoan', initial: { employeeId: id() } }" [extraRowActions]="loanActions" /></ng-template>
    <ng-template appTab="performance" [label]="T('performance') | translate">
      <app-sub title="Reviews"><app-op-view op="performance.history" [path]="path()" [bare]="true" /></app-sub>
      <app-sub title="Goals"><app-op-view op="performance.goalsOf" [path]="path()" [bare]="true" /></app-sub>
      <app-sub title="Feedback"><app-op-view op="performance.about" [path]="path()" [bare]="true" /></app-sub></ng-template>
    <ng-template appTab="tax" [label]="T('tax') | translate" [hidden]="!canTax()">
      <app-sub title="Income-tax statement"><app-op-view op="tax.statement" [query]="{ employeeId: id(), financialYear: fy }" [bare]="true" /></app-sub>
      <app-sub title="Tax computation"><app-op-view op="tax.compute" [query]="{ employeeId: id(), financialYear: fy }" [bare]="true" /></app-sub>
      <app-sub title="Monthly TDS"><app-op-view op="tax.monthlyTds" [query]="{ employeeId: id(), month: month }" [bare]="true" /></app-sub>
      <app-sub title="Tax documents"><app-op-view op="tax.documents" [query]="{ employeeId: id() }" [bare]="true" /></app-sub></ng-template>
    <ng-template appTab="audit" [label]="T('audit') | translate" [hidden]="!perm.isAdmin()">
      <app-sub title="Profile changes"><app-op-view op="employee.profileHistory" [path]="path()" [bare]="true" /></app-sub>
      <app-sub title="Audit"><app-op-table op="employee.searchAudit" [query]="{ entityId: id() }" tableId="emp-audit" /></app-sub></ng-template>
  </app-tabs>
  <ng-template #loanActions let-r><app-op-button op="payroll.closeLoan" [path]="{ id: r.id }" label="Close" variant="ghost" /></ng-template>
  }`,
})
export class EmployeeProfilePage {
  perm = inject(PermissionService); refs = inject(RefService); private store = inject(Store);
  id = input.required<string>();
  q = injectOp<any>('employee.get', () => ({ path: { id: this.id() } }));
  e = computed(() => this.q.data() ?? {});
  path = computed(() => ({ employeeId: this.id() }));
  ini = computed(() => initials(this.e().fullName));
  isSelf = computed(() => this.perm.user()?.employeeId === this.id());
  year = new Date().getFullYear(); month = monthStr(); fy = financialYear();
  range = { from: isoDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1)), to: isoDate(new Date()) };
  rowPath = (r: any) => ({ employeeId: this.id(), id: r.id });
  canBank = computed(() => this.perm.isAdmin() || this.isSelf() || this.perm.hasRole('PAYROLL_ADMIN', 'FINANCE_ADMIN'));
  canPayroll = computed(() => this.perm.canAny('payroll.payslipsOf') || this.isSelf());
  canTax = computed(() => this.perm.isAdmin() || this.perm.hasRole('FINANCE_ADMIN') || this.isSelf());
  T = (k: string) => `hr.employees.tabs.${k}`;
  constructor() {
    effect(() => { const e = this.q.data(); if (e?.fullName) untracked(() => this.store.dispatch(RecentActions.visited({ record: { id: 'e' + this.id(), kind: 'employee', title: e.fullName, link: `/employees/${this.id()}`, at: Date.now() } }))); });
  }
}
export default EmployeeProfilePage;
