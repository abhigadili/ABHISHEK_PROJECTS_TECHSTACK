import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { injectOp } from '../../api/queries/op-query';
import { LanguageService } from '../../core/services/language.service';
import { PermissionService } from '../../core/services/permission.service';
import { ChartCardComponent } from '../../shared/charts/chart-card.component';
import { barOption, donutOption } from '../../shared/charts/chart-options';
import { ModalComponent } from '../../shared/components/modal.component';
import { CardComponent, PageHeaderComponent, TabDirective, TabsComponent } from '../../shared/components/ui.components';
import { CrudSectionComponent } from '../../shared/op/crud-section.component';
import { DownloadButtonComponent } from '../../shared/op/download-button.component';
import { EmployeeScopeComponent } from '../../shared/op/employee-scope.component';
import { OpButtonComponent } from '../../shared/op/op-button.component';
import { OpViewComponent } from '../../shared/op/op-view.component';
import { OpTableComponent } from '../../shared/tables/op-table.component';
import { type Col } from '../../shared/tables/data-table.component';
import { monthStr } from '../../shared/utilities/date';

const DEC = { comment: { rich: true } };

@Component({
  selector: 'app-payslip-breakdown', standalone: true, changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="row g-3 mb-3">@for (s of summary(); track s[0]) { <div class="col-4"><div class="rounded-3 p-2 text-center" style="background:var(--hr-surface-2)"><div class="text-muted" style="font-size:11px">{{ s[0] }}</div><div class="fw-bold">{{ lang.money(s[1]) }}</div></div></div> }</div>
    @if (lines().length) { <div class="row g-3">@for (c of cols(); track c[0]) { <div class="col-md-6"><div class="field-label">{{ c[0] }}</div>@for (l of c[1]; track $index) { <div class="d-flex justify-content-between py-1" style="font-size:13px;border-bottom:1px solid var(--hr-border)"><span>{{ l.name ?? l.componentName ?? l.code }}</span><span>{{ lang.money(l.amount) }}</span></div> }</div> }</div> }
    @else { <div class="text-muted" style="font-size:12px">Salary breakdown is in the downloadable PDF.</div> }`,
})
export class PayslipBreakdownComponent {
  lang = inject(LanguageService); p = input.required<any>();
  lines = computed<any[]>(() => this.p().lines ?? this.p().components ?? this.p().items ?? []);
  cols = computed<[string, any[]][]>(() => [['Earnings', this.lines().filter((l) => (l.type ?? l.kind) === 'EARNING')], ['Deductions', this.lines().filter((l) => (l.type ?? l.kind) === 'DEDUCTION')]]);
  summary = computed<[string, number][]>(() => { const p = this.p(); return [['Gross', p.gross ?? p.grossPay ?? p.totalGross], ['Deductions', p.totalDeductions ?? p.deductions], ['Net pay', p.net ?? p.netPay ?? p.totalNet]]; });
}

@Component({
  selector: 'app-payslips', standalone: true, changeDetection: ChangeDetectionStrategy.Default,
  imports: [CardComponent, OpTableComponent, ModalComponent, DownloadButtonComponent, PayslipBreakdownComponent],
  template: `<app-card title="Payslips"><app-op-table [op]="op()" [path]="path()" [tableId]="'payslips-' + (employeeId() || 'me')" [rowClickable]="true" (rowClick)="open.set($event)" [rowActions]="dl" /></app-card>
    <app-modal [open]="!!open()" [title]="'Payslip ' + (open()?.payrollMonth ?? '')" size="lg" (closed)="open.set(null)">
      @if (open(); as o) { <div class="mb-2 text-muted" style="font-size:12px">{{ lang.date(o.generatedAt ?? o.createdAt) }}</div><app-payslip-breakdown [p]="o" /> }
      <ng-container footer>@if (open(); as o) { <app-download-button op="payroll.download" [path]="{ id: o.id }" [filename]="'payslip-' + o.payrollMonth + '.pdf'" variant="outline" /><app-download-button op="payroll.download" [path]="{ id: o.id }" filename="payslip.pdf" [print]="true" variant="outline" /> }</ng-container></app-modal>
    <ng-template #dl let-r><app-download-button op="payroll.download" [path]="{ id: r.id }" [filename]="'payslip-' + (r.payrollMonth ?? r.month ?? r.id) + '.pdf'" /><app-download-button op="payroll.download" [path]="{ id: r.id }" filename="payslip.pdf" [print]="true" /></ng-template>`,
})
export class PayslipsComponent {
  lang = inject(LanguageService); employeeId = input<string>(); open = signal<any>(null);
  op = computed(() => (this.employeeId() ? 'payroll.payslipsOf' : 'payroll.myPayslips')); path = computed(() => (this.employeeId() ? { employeeId: this.employeeId()! } : undefined));
}

@Component({
  selector: 'app-salary', standalone: true, changeDetection: ChangeDetectionStrategy.Default, imports: [OpViewComponent, OpButtonComponent],
  template: `<div class="d-grid gap-3"><app-op-view op="payroll.summary" [path]="path()" title="Salary summary" />
    <app-op-view op="payroll.salary" [path]="path()" title="Current salary structure"><span actions class="d-flex gap-2"><app-op-button op="payroll.assign" [path]="path()" label="Assign salary" dialogSize="lg" /><app-op-button op="payroll.propose" [path]="path()" label="Propose revision" dialogSize="lg" /></span></app-op-view>
    <app-op-view op="payroll.salaryHistory" [path]="path()" title="Salary history" /></div>`,
})
export class SalaryComponent { employeeId = input.required<string>(); path = computed(() => ({ employeeId: this.employeeId() })); }

@Component({
  selector: 'app-pay-runs', standalone: true, changeDetection: ChangeDetectionStrategy.Default, imports: [TranslateModule, CrudSectionComponent, OpButtonComponent, ModalComponent, OpTableComponent, OpViewComponent],
  template: `<app-crud-section title="Payroll runs" [list]="{ op: 'payroll.list' }" [create]="{ op: 'payroll.create' }" tableId="pay-runs" [remove]="{ op: 'payroll.delete', path: idp }" [columns]="cols" [view]="{ op: 'payroll.get', path: idp }" [extraRowActions]="acts" />
    <app-modal [open]="!!sel()" [title]="'Entries · ' + (sel()?.payrollMonth ?? '')" size="xl" (closed)="sel.set(null)">@if (sel(); as s) { <app-op-table op="payroll.entries" [path]="{ id: s.id }" tableId="pay-entries" [rowClickable]="true" (rowClick)="entry.set($event.id)" /> }</app-modal>
    <app-modal [open]="!!entry()" title="Payroll entry" size="lg" (closed)="entry.set(null)">@if (entry(); as e) { <app-op-view op="payroll.entry" [path]="{ entryId: e }" [bare]="true" /> }</app-modal>
    <ng-template #acts let-r><button type="button" class="btn-hr ghost sm" (click)="sel.set(r)">Entries</button>
      @if (r.status === 'DRAFT') { <app-op-button op="payroll.process" [path]="{ id: r.id }" icon="pi-play" label="Process" variant="outline" /> }
      @if (r.status === 'PROCESSED') { <app-op-button op="payroll.approve" [path]="{ id: r.id }" icon="pi-check" [label]="'common.approve' | translate" variant="success" /> }
      @if (r.status === 'APPROVED') { <app-op-button op="payroll.finalizeRun" [path]="{ id: r.id }" icon="pi-lock" label="Finalize" variant="outline" /> }
      @if (r.status !== 'DRAFT') { <app-op-button op="payroll.regenerate" [path]="{ id: r.id }" label="Payslips" variant="ghost" /> }</ng-template>`,
})
export class PayRunsComponent {
  sel = signal<any>(null); entry = signal<string | null>(null); idp = (r: any) => ({ id: r.id });
  cols: Col[] = [{ key: 'payrollMonth', sortable: false }, { key: 'status' }, { key: 'employeeCount' }, { key: 'totalGross' }, { key: 'totalDeductions' }, { key: 'totalNet' }, { key: 'processedBy', hidden: true }, { key: 'approvedBy', hidden: true }, { key: 'finalizedAt', hidden: true }];
}

@Component({
  selector: 'app-pay-setup', standalone: true, changeDetection: ChangeDetectionStrategy.Default, imports: [CrudSectionComponent],
  template: `<div class="d-grid gap-3">
    <app-crud-section title="Salary components" [list]="{ op: 'payroll.components' }" [create]="{ op: 'payroll.createComponent' }" [update]="{ op: 'payroll.updateComponent', path: idp }" dialogSize="lg" />
    <app-crud-section title="Salary structures" [list]="{ op: 'payroll.structures' }" [create]="{ op: 'payroll.createStructure' }" [update]="{ op: 'payroll.updateStructure', path: idp }" [remove]="{ op: 'payroll.deleteStructure', path: idp }" [view]="{ op: 'payroll.structure', path: idp }" dialogSize="xl" />
    <app-crud-section title="Statutory & payroll configuration" [list]="{ op: 'payroll.config' }" [columns]="cfgCols" [update]="{ op: 'payroll.updateConfig', path: keyp, initial: cfgInit }" /></div>`,
})
export class PaySetupComponent {
  idp = (r: any) => ({ id: r.id }); keyp = (r: any) => ({ key: r.key }); cfgInit = (r: any) => ({ value: r.value, description: r.description });
  cfgCols: Col[] = [{ key: 'key' }, { key: 'value' }, { key: 'description' }, { key: 'effectiveFrom' }];
}

@Component({
  selector: 'app-pay-revisions', standalone: true, changeDetection: ChangeDetectionStrategy.Default, imports: [FormsModule, TranslateModule, CardComponent, OpTableComponent, OpButtonComponent],
  template: `<app-card title="Salary revisions"><select actions class="form-select" style="width:auto" [ngModel]="status()" (ngModelChange)="status.set($event)" [attr.aria-label]="'common.status' | translate"><option value="">{{ 'common.all' | translate }}</option>@for (s of sts; track s) { <option>{{ s }}</option> }</select>
    <app-op-table op="payroll.revisions" [query]="{ status: status() }" tableId="pay-rev" [rowActions]="acts" /></app-card>
    <ng-template #acts let-r><app-op-button op="payroll.approveRevision" [path]="{ id: r.id }" [label]="'common.approve' | translate" icon="pi-check" variant="success" [overrides]="dec" /><app-op-button op="payroll.rejectRevision" [path]="{ id: r.id }" [label]="'common.reject' | translate" icon="pi-times" variant="danger" [overrides]="dec" /></ng-template>`,
})
export class PayRevisionsComponent { status = signal(''); sts = ['PENDING', 'APPROVED', 'REJECTED']; dec = DEC; }

@Component({
  selector: 'app-pay-adjustments', standalone: true, changeDetection: ChangeDetectionStrategy.Default, imports: [FormsModule, CrudSectionComponent],
  template: `<app-crud-section [title]="'Adjustments · ' + month()" [list]="{ op: 'payroll.adjustments', query: { month: month() } }" [create]="{ op: 'payroll.addAdjustment', initial: { month: month() } }" [remove]="{ op: 'payroll.cancelAdjustment', path: idp }">
    <input actions type="month" class="form-control" style="width:auto" [ngModel]="month()" (ngModelChange)="$event && month.set($event)" /></app-crud-section>`,
})
export class PayAdjustmentsComponent { month = signal(monthStr()); idp = (r: any) => ({ id: r.id }); }

@Component({
  selector: 'app-pay-reports', standalone: true, changeDetection: ChangeDetectionStrategy.Default, imports: [FormsModule, ChartCardComponent, OpViewComponent],
  template: `<div class="d-grid gap-3"><input type="month" class="form-control" style="width:auto" [ngModel]="month()" (ngModelChange)="$event && month.set($event)" />
    <app-op-view op="payroll.monthly" [query]="{ month: month() }" [title]="'Monthly report · ' + month()" />
    <div class="row g-3"><div class="col-lg-6"><app-chart-card title="Department totals" [loading]="dep.isLoading()" [error]="dep.error()" [empty]="!dd().length" [build]="bDep" /></div>
      <div class="col-lg-6"><app-chart-card title="Component totals" [loading]="comp.isLoading()" [error]="comp.error()" [empty]="!cc().length" [build]="bComp" /></div></div>
    <app-op-view op="payroll.departments" [query]="{ month: month() }" title="Departments" /><app-op-view op="payroll.componentsPayrollProcessing" [query]="{ month: month() }" title="Components" /></div>`,
})
export class PayReportsComponent {
  month = signal(monthStr());
  dep = injectOp<any[]>('payroll.departments', () => ({ query: { month: this.month() } })); comp = injectOp<any[]>('payroll.componentsPayrollProcessing', () => ({ query: { month: this.month() } }));
  dd = computed(() => (this.dep.data() ?? []).map((d) => ({ name: d.departmentName ?? d.department ?? d.departmentId, net: Number(d.net ?? d.totalNet ?? 0), gross: Number(d.gross ?? d.totalGross ?? 0) })));
  cc = computed(() => (this.comp.data() ?? []).map((c) => ({ name: c.componentName ?? c.name ?? c.code, value: Number(c.total ?? c.amount ?? 0) })).filter((c) => c.value));
  bDep = (dark: boolean) => barOption(dark, this.dd(), 'name', [{ key: 'gross', label: 'Gross' }, { key: 'net', label: 'Net' }]); bComp = (dark: boolean) => donutOption(dark, this.cc());
}

@Component({
  selector: 'app-payroll-page', standalone: true, changeDetection: ChangeDetectionStrategy.Default,
  imports: [TranslateModule, PageHeaderComponent, TabsComponent, TabDirective, PayslipsComponent, SalaryComponent, PayRunsComponent, PaySetupComponent, PayRevisionsComponent, PayAdjustmentsComponent, PayReportsComponent, EmployeeScopeComponent, OpViewComponent, OpButtonComponent],
  template: `<app-page-header [title]="'hr.payroll.title' | translate" [subtitle]="'hr.payroll.sub' | translate" />
  <app-tabs>
    <ng-template appTab="payslips" label="My payslips" [hidden]="!self()"><app-payslips /></ng-template>
    <ng-template appTab="salary" label="My salary" [hidden]="!self()">@if (self(); as s) { <app-salary [employeeId]="s" /> }</ng-template>
    <ng-template appTab="runs" label="Payroll runs" [hidden]="!staff()"><app-pay-runs /></ng-template>
    <ng-template appTab="employee" label="Employee payroll" [hidden]="!perm.canCall('payroll.payslipsOf')">
      <app-employee-scope><ng-template let-id><div class="d-grid gap-3"><app-salary [employeeId]="id" /><app-payslips [employeeId]="id" />
        <app-op-view op="payroll.loans" [path]="{ employeeId: id }" title="Loans"><span actions><app-op-button op="payroll.addLoan" [initial]="{ employeeId: id }" label="Add loan" /></span></app-op-view></div></ng-template></app-employee-scope></ng-template>
    <ng-template appTab="revisions" label="Revisions" [hidden]="!perm.canCall('payroll.revisions')"><app-pay-revisions /></ng-template>
    <ng-template appTab="adjust" label="Adjustments" [hidden]="!staff()"><app-pay-adjustments /></ng-template>
    <ng-template appTab="setup" [label]="'common.settings' | translate" [hidden]="!perm.canCall('payroll.components')"><app-pay-setup /></ng-template>
    <ng-template appTab="reports" [label]="'nav.reports' | translate" [hidden]="!staff()"><app-pay-reports /></ng-template>
  </app-tabs>`,
})
export class PayrollPage { perm = inject(PermissionService); self = computed(() => this.perm.user()?.employeeId ?? null); staff = computed(() => this.perm.canCall('payroll.list')); }
export default PayrollPage;
