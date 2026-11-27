import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { QueryClient } from '@tanstack/angular-query-experimental';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { ApiClient } from '../../api/client/api-client.service';
import { PermissionService } from '../../core/services/permission.service';
import { ToastService } from '../../core/services/toast.service';
import { EMPLOYEE_STATUS } from '../../core/constants/enums';
import { ModalComponent } from '../../shared/components/modal.component';
import { PageHeaderComponent } from '../../shared/components/ui.components';
import { RefService } from '../../shared/components/ref.service';
import { OpDialogComponent } from '../../shared/op/op-dialog.component';
import { OpTableComponent } from '../../shared/tables/op-table.component';
import { type Col } from '../../shared/tables/data-table.component';

const COLS: Col[] = [
  { key: 'employeeCode', sortable: true }, { key: 'fullName', sortable: false }, { key: 'workEmail' }, { key: 'departmentId' }, { key: 'designationId' },
  { key: 'locationId', hidden: true }, { key: 'managerId', hidden: true }, { key: 'employmentType', hidden: true }, { key: 'joiningDate', sortable: true }, { key: 'status', sortable: true },
];
const FALLBACK_COLS: Col[] = [{ key: 'employeeCode' }, { key: 'fullName' }, { key: 'workEmail' }, { key: 'departmentId' }, { key: 'designationId' }, { key: 'status' }];

/** Bulk CSV import: parsed in the browser, then one POST /employees per row (the backend has no bulk endpoint); per-row results are shown. */
@Component({
  selector: 'app-employee-import', standalone: true, imports: [ModalComponent, TranslateModule], changeDetection: ChangeDetectionStrategy.Default,
  template: `<app-modal [open]="open()" [title]="('common.import' | translate) + ' · ' + ('nav.employees' | translate)" description="CSV columns: firstName,lastName,workEmail,joiningDate,gender,employmentType,departmentId,designationId,locationId,managerId" size="lg" (closed)="closed.emit()">
    <input type="file" accept=".csv,text/csv" class="form-control mb-3" (change)="onFile($event)" />
    @if (rows().length) { <div class="mb-2 text-muted" style="font-size:12px">{{ rows().length }} row(s) ready</div> }
    <ul class="m-0 list-unstyled" style="font-size:12px">@for (r of res(); track $index) { <li [style.color]="r.ok ? 'var(--hr-success)' : 'var(--hr-danger)'">{{ r.ok ? '✓' : '✗' }} {{ r.msg }}</li> }</ul>
    <ng-container footer><button type="button" class="btn-hr outline" (click)="closed.emit()">{{ 'common.close' | translate }}</button>
      <button type="button" class="btn-hr primary ms-2" [disabled]="busy() || !rows().length" (click)="run()">{{ 'common.import' | translate }} ({{ rows().length }})</button></ng-container></app-modal>`,
})
export class EmployeeImportComponent {
  private api = inject(ApiClient); private qc = inject(QueryClient); private toast = inject(ToastService);
  open = input(false); closed = output<void>();
  rows = signal<Record<string, string>[]>([]); res = signal<{ ok: boolean; msg: string }[]>([]); busy = signal(false);
  async onFile(e: Event) {
    const f = (e.target as HTMLInputElement).files?.[0]; if (!f) return;
    const lines = (await f.text()).replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim()); const head = lines[0].split(',').map((h) => h.trim());
    this.rows.set(lines.slice(1).map((l) => { const c = l.split(','); return Object.fromEntries(head.map((h, i) => [h, (c[i] ?? '').trim()])); })); this.res.set([]); this.toast.info('common.fileUploaded');
  }
  async run() {
    this.busy.set(true); const out: { ok: boolean; msg: string }[] = [];
    for (const r of this.rows()) {
      const body: any = { ...r }; Object.keys(body).forEach((k) => body[k] === '' && delete body[k]); if (body.noticePeriodDays) body.noticePeriodDays = Number(body.noticePeriodDays);
      try { await firstValueFrom(this.api.call('employee.onboard', { body })); out.push({ ok: true, msg: `${r['firstName']} ${r['lastName']}` }); } catch (e: any) { out.push({ ok: false, msg: `${r['firstName']} ${r['lastName']}: ${e.message}` }); }
      this.res.set([...out]);
    }
    this.busy.set(false); this.qc.invalidateQueries({ queryKey: ['api', 'employee'] });
  }
}

@Component({
  selector: 'app-employees-page', standalone: true, changeDetection: ChangeDetectionStrategy.Default,
  imports: [FormsModule, TranslateModule, PageHeaderComponent, OpTableComponent, OpDialogComponent, ModalComponent, EmployeeImportComponent],
  template: `
  <app-page-header [title]="'hr.employees.title' | translate" [subtitle]="'hr.employees.sub' | translate">
    @if (perm.canCall('employee.onboard')) { <button type="button" class="btn-hr outline" (click)="imp.set(true)"><i class="pi pi-upload"></i>{{ 'common.import' | translate }}</button>
      <button type="button" class="btn-hr primary" (click)="add.set(true)"><i class="pi pi-user-plus"></i>{{ 'hr.employees.add' | translate }}</button> }
  </app-page-header>
  <app-op-table op="employee.search" tableId="employees" [fallback]="fb" searchParam="q" [columns]="cols" [sortable]="['employeeCode', 'joiningDate', 'status']" [query]="query()" [selectable]="true" exportName="employees" [rowClickable]="true" (rowClick)="open($event)" [bulkActions]="bulk">
    <span filters class="d-contents contents"><!-- template-driven quick filters -->
      <select class="form-select" style="width:auto" [ngModel]="f().status" (ngModelChange)="set('status', $event)" aria-label="status"><option value="">{{ 'common.status' | translate }}</option>@for (s of statuses; track s.value) { <option [value]="s.value">{{ s.label }}</option> }</select>
      <select class="form-select" style="width:auto" [ngModel]="f().departmentId" (ngModelChange)="set('departmentId', $event)" aria-label="department"><option value="">{{ 'common.department' | translate }}</option>@for (o of deps(); track o.value) { <option [value]="o.value">{{ o.label }}</option> }</select>
      <select class="form-select" style="width:auto" [ngModel]="f().designationId" (ngModelChange)="set('designationId', $event)" aria-label="designation"><option value="">{{ 'common.designation' | translate }}</option>@for (o of desigs(); track o.value) { <option [value]="o.value">{{ o.label }}</option> }</select></span>
  </app-op-table>
  <ng-template #fb><div class="d-grid gap-3"><div role="alert" class="rounded-2 p-3" style="font-size:12px;border:1px solid rgb(var(--hr-warning-rgb)/.4);background:rgb(var(--hr-warning-rgb)/.1)">The full employee list failed on the server (HTTP 5xx) - typically a record the API cannot read. Showing the company directory (non-sensitive columns) instead.</div>
    <app-op-table op="employee.directory" tableId="employees-fallback" searchParam="q" [columns]="fbCols" [rowClickable]="true" (rowClick)="open($event)" /></div></ng-template>
  <ng-template #bulk let-rows>
    @if (perm.canCall('employee.status')) { <button type="button" class="btn-hr outline sm" (click)="bulkRows.set(rows); bulkOpen.set(true)">{{ 'common.status' | translate }} →</button> }</ng-template>
  <app-employee-import [open]="imp()" (closed)="imp.set(false)" />
  <app-modal [open]="bulkOpen()" [title]="('common.status' | translate) + ' · ' + bulkRows().length" size="sm" (closed)="bulkOpen.set(false)">
    <select class="form-select" [(ngModel)]="bulkStatus" name="bs">@for (s of statuses; track s.value) { <option [value]="s.value">{{ s.label }}</option> }</select>
    <ng-container footer><button type="button" class="btn-hr outline" (click)="bulkOpen.set(false)">{{ 'common.cancel' | translate }}</button><button type="button" class="btn-hr primary ms-2" [disabled]="busy()" (click)="applyBulk()">{{ 'common.apply' | translate }}</button></ng-container></app-modal>
  @if (add()) { <app-op-dialog [open]="true" op="employee.onboard" [title]="'hr.employees.add' | translate" size="lg" (done)="created($event)" (closed)="add.set(false)" /> }`,
})
export class EmployeesPage {
  perm = inject(PermissionService); private router = inject(Router); private refs = inject(RefService); private api = inject(ApiClient); private qc = inject(QueryClient); private toast = inject(ToastService); private tr = inject(TranslateService);
  cols = COLS; fbCols = FALLBACK_COLS; statuses = EMPLOYEE_STATUS;
  f = signal({ status: '', departmentId: '', designationId: '' }); imp = signal(false); add = signal(false);
  deps = this.refs.options('department'); desigs = this.refs.options('designation');
  query = computed(() => ({ ...this.f() }));
  bulkOpen = signal(false); bulkRows = signal<any[]>([]); bulkStatus = 'INACTIVE'; busy = signal(false);
  set(k: 'status' | 'departmentId' | 'designationId', v: string) { this.f.set({ ...this.f(), [k]: v }); }
  open(r: any) { this.router.navigate(['/employees', r.id]); }
  created(d: any) { if (d?.id) this.router.navigate(['/employees', d.id]); }
  async applyBulk() {
    this.busy.set(true); let ok = 0; const errs: string[] = [];
    for (const r of this.bulkRows()) { try { await firstValueFrom(this.api.call('employee.status', { path: { id: r.id }, body: { status: this.bulkStatus } })); ok++; } catch (e: any) { errs.push(`${r.employeeCode}: ${e.message}`); } }
    this.busy.set(false); this.bulkOpen.set(false); this.qc.invalidateQueries({ queryKey: ['api', 'employee'] });
    errs.length ? this.toast.error(`${ok} updated, ${errs.length} failed — ${errs[0]}`) : this.toast.success(`${ok} ${this.tr.instant('common.saved')}`);
  }
}
export default EmployeesPage;
