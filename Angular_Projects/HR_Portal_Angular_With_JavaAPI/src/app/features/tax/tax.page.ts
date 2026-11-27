import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { injectOp } from '../../api/queries/op-query';
import { PermissionService } from '../../core/services/permission.service';
import { ModalComponent } from '../../shared/components/modal.component';
import { SafeHtmlComponent } from '../../shared/components/safe-html.component';
import { CardComponent, LoadingBlockComponent, PageHeaderComponent, TabDirective, TabsComponent } from '../../shared/components/ui.components';
import { DetailComponent } from '../../shared/components/value.components';
import { CrudSectionComponent } from '../../shared/op/crud-section.component';
import { EmployeeScopeComponent } from '../../shared/op/employee-scope.component';
import { OpButtonComponent } from '../../shared/op/op-button.component';
import { OpViewComponent } from '../../shared/op/op-view.component';
import { DataTableComponent, type Col } from '../../shared/tables/data-table.component';
import { OpTableComponent } from '../../shared/tables/op-table.component';
import { financialYear, monthStr } from '../../shared/utilities/date';

const DEC = { comment: { rich: true } };

/** Proof upload references a document stored by the document service - offer "my documents" as options. */
@Component({
  selector: 'app-proof-button', standalone: true, imports: [OpButtonComponent], changeDetection: ChangeDetectionStrategy.Default,
  template: `<app-op-button op="tax.addProof" [path]="{ id: declId(), investmentId: inv().id }" label="Add proof" variant="ghost" [overrides]="ov()" />`,
})
export class ProofButtonComponent {
  declId = input.required<string>(); inv = input.required<any>();
  docs = injectOp<any[]>('document.mine');
  ov = computed(() => ({ documentId: { options: (this.docs.data() ?? []).map((d) => ({ value: d.id, label: `${d.title ?? d.fileName} (${d.categoryCode ?? ''})` })) }, fileName: { help: 'optional' } }));
}

@Component({
  selector: 'app-declaration-detail', standalone: true, changeDetection: ChangeDetectionStrategy.Default,
  imports: [TranslateModule, ModalComponent, DetailComponent, SafeHtmlComponent, DataTableComponent, OpViewComponent, OpButtonComponent, LoadingBlockComponent, ProofButtonComponent],
  template: `<app-modal [open]="true" [title]="'Declaration ' + (d()?.financialYear ?? '')" size="xl" (closed)="closed.emit()">
    @if (q.isLoading()) { <app-loading-block /> }
    @if (d(); as d) { <div class="d-grid gap-3">
      <app-detail [data]="d" [hide]="['id', 'investments', 'reviewComment']" />
      @if (d.reviewComment) { <div><div class="field-label">Review comment</div><app-safe-html [html]="d.reviewComment" /></div> }
      <div><div class="field-label">Investments</div><app-data-table id="tax-inv" [rows]="d.investments ?? []" [rowActions]="proof" /></div>
      <app-op-view op="tax.history" [path]="{ id: id() }" title="History" /></div> }
    <ng-template #proof let-r><app-proof-button [declId]="id()" [inv]="r" /></ng-template>
    <ng-container footer>@if (d(); as d) {
      @if (d.status === 'DRAFT') { <app-op-button op="tax.submit" [path]="{ id: id() }" [label]="'common.submit' | translate" variant="primary" size="md" /> }
      @if (perm.canCall('tax.startReview') && d.status === 'SUBMITTED') { <app-op-button op="tax.startReview" [path]="{ id: id() }" label="Start review" size="md" /> }
      @if (perm.canCall('tax.approve') && (d.status === 'SUBMITTED' || d.status === 'UNDER_REVIEW')) { <app-op-button op="tax.approve" [path]="{ id: id() }" [label]="'common.approve' | translate" variant="success" size="md" [overrides]="dec" /><app-op-button op="tax.reject" [path]="{ id: id() }" [label]="'common.reject' | translate" variant="danger" size="md" [overrides]="dec" /> } }</ng-container>
  </app-modal>`,
})
export class DeclarationDetailComponent {
  perm = inject(PermissionService); dec = DEC; id = input.required<string>(); closed = output<void>();
  q = injectOp<any>('tax.get', () => ({ path: { id: this.id() } })); d = computed(() => this.q.data());
}

@Component({
  selector: 'app-tax-mine', standalone: true, changeDetection: ChangeDetectionStrategy.Default,
  imports: [FormsModule, TranslateModule, CardComponent, OpTableComponent, OpViewComponent, OpButtonComponent, CrudSectionComponent, DeclarationDetailComponent],
  template: `<app-card title="Tax declarations"><span actions class="d-flex gap-2"><input class="form-control" style="width:110px" [ngModel]="fy()" (ngModelChange)="fy.set($event)" aria-label="financial year" />
      <app-op-button op="tax.save" label="New / update declaration" variant="primary" size="md" dialogSize="lg" [initial]="{ financialYear: fy() }" [overrides]="FY" /></span>
    <app-op-table op="tax.mine" [query]="{ financialYear: fy() }" tableId="tax-mine" [columns]="cols" [rowClickable]="true" (rowClick)="open.set($event.id)" [rowActions]="view" /></app-card>
  <ng-template #view let-r><button type="button" class="btn-hr ghost sm" (click)="open.set(r.id)"><i class="pi pi-eye"></i>{{ 'common.view' | translate }}</button></ng-template>
  <div class="mt-3 d-grid gap-3"><app-op-view op="tax.statement" [query]="{ financialYear: fy(), employeeId: self() }" title="Income-tax statement" /><app-op-view op="tax.compute" [query]="{ financialYear: fy(), employeeId: self() }" title="Tax computation" />
    <app-op-view op="tax.monthlyTds" [query]="{ month: month, employeeId: self() }" title="Monthly TDS" /><app-crud-section title="Income-tax documents" [list]="{ op: 'tax.documents', query: { financialYear: fy(), employeeId: self() } }" /></div>
  @if (open(); as o) { <app-declaration-detail [id]="o" (closed)="open.set(null)" /> }`,
})
export class TaxMineComponent {
  perm = inject(PermissionService); self = computed(() => this.perm.user()?.employeeId); fy = signal(financialYear()); open = signal<string | null>(null); month = monthStr(); FY = { financialYear: { help: 'e.g. 2026-27' } };
  cols: Col[] = [{ key: 'financialYear' }, { key: 'regime' }, { key: 'status' }, { key: 'totalDeclared' }, { key: 'totalApproved' }, { key: 'submittedAt' }];
}

@Component({
  selector: 'app-tax-review', standalone: true, changeDetection: ChangeDetectionStrategy.Default, imports: [TranslateModule, CardComponent, OpTableComponent, OpButtonComponent, DeclarationDetailComponent],
  template: `<div class="d-grid gap-3"><app-card title="Declarations awaiting review"><app-op-table op="tax.pending" tableId="tax-pending" [rowClickable]="true" (rowClick)="open.set($event.id)" /></app-card>
    <app-card title="Proofs awaiting verification"><app-op-table op="tax.proofsPending" tableId="tax-proofs" [rowActions]="acts" /></app-card>
    @if (open(); as o) { <app-declaration-detail [id]="o" (closed)="open.set(null)" /> }</div>
    <ng-template #acts let-r><app-op-button op="tax.verify" [path]="{ proofId: r.id }" label="Verify" icon="pi-check" variant="success" /><app-op-button op="tax.rejectProof" [path]="{ proofId: r.id }" [label]="'common.reject' | translate" icon="pi-times" variant="danger" [overrides]="dec" /></ng-template>`,
})
export class TaxReviewComponent { open = signal<string | null>(null); dec = DEC; }

@Component({
  selector: 'app-tax-admin', standalone: true, changeDetection: ChangeDetectionStrategy.Default, imports: [FormsModule, CardComponent, OpViewComponent, OpButtonComponent, CrudSectionComponent, EmployeeScopeComponent],
  template: `<div class="d-grid gap-3"><div class="d-flex gap-2 align-items-center"><input class="form-control" style="width:110px" [ngModel]="fy()" (ngModelChange)="fy.set($event)" aria-label="financial year" /><app-op-button op="tax.reminders" label="Send proof reminders" size="md" /></div>
    <app-op-view op="tax.status" [query]="{ financialYear: fy() }" title="Declaration status summary" />
    <app-crud-section title="Tax rules & slabs" [list]="{ op: 'tax.rules', query: { financialYear: fy() } }" [create]="{ op: 'tax.createRule', initial: { financialYear: fy() } }" [update]="{ op: 'tax.updateRule', path: idp }" dialogSize="xl" />
    <app-card title="Issue income-tax document"><app-op-button actions op="tax.addDocument" label="Add document" variant="primary" size="md" [initial]="{ financialYear: fy() }" />
      <app-employee-scope><ng-template let-id><app-op-view op="tax.documents" [query]="{ employeeId: id, financialYear: fy() }" title="Documents" /></ng-template></app-employee-scope></app-card></div>`,
})
export class TaxAdminComponent { fy = signal(financialYear()); idp = (r: any) => ({ id: r.id }); }

@Component({
  selector: 'app-tax-page', standalone: true, changeDetection: ChangeDetectionStrategy.Default,
  imports: [TranslateModule, PageHeaderComponent, TabsComponent, TabDirective, TaxMineComponent, TaxReviewComponent, TaxAdminComponent, EmployeeScopeComponent, OpViewComponent],
  template: `<app-page-header [title]="'hr.tax.title' | translate" [subtitle]="'hr.tax.sub' | translate" />
  <app-tabs>
    <ng-template appTab="mine" [label]="'nav.myWorkspace' | translate" [hidden]="!self()"><app-tax-mine /></ng-template>
    <ng-template appTab="review" label="Review" [hidden]="!perm.canCall('tax.pending')"><app-tax-review /></ng-template>
    <ng-template appTab="admin" [label]="'hr.leave.admin' | translate" [hidden]="!perm.canAny('tax.rules', 'tax.status')"><app-tax-admin /></ng-template>
    <ng-template appTab="lookup" label="Employee tax" [hidden]="!perm.canCall('tax.compute') || !perm.isAdmin()"><app-employee-scope><ng-template let-id><div class="d-grid gap-3">
      <app-op-view op="tax.statement" [query]="{ employeeId: id, financialYear: fy }" title="Statement" /><app-op-view op="tax.compute" [query]="{ employeeId: id, financialYear: fy }" title="Computation" /><app-op-view op="tax.monthlyTds" [query]="{ employeeId: id, month: month }" title="Monthly TDS" /></div></ng-template></app-employee-scope></ng-template>
  </app-tabs>`,
})
export class TaxPage { perm = inject(PermissionService); self = computed(() => !!this.perm.user()?.employeeId); fy = financialYear(); month = monthStr(); }
export default TaxPage;
