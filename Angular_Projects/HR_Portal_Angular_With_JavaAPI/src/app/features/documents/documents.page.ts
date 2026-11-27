import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { injectOp } from '../../api/queries/op-query';
import { PermissionService } from '../../core/services/permission.service';
import { ModalComponent } from '../../shared/components/modal.component';
import { CardComponent, LoadingBlockComponent, PageHeaderComponent, TabDirective, TabsComponent } from '../../shared/components/ui.components';
import { DetailComponent } from '../../shared/components/value.components';
import { CrudSectionComponent } from '../../shared/op/crud-section.component';
import { DownloadButtonComponent } from '../../shared/op/download-button.component';
import { EmployeeScopeComponent } from '../../shared/op/employee-scope.component';
import { OpButtonComponent } from '../../shared/op/op-button.component';
import { OpViewComponent } from '../../shared/op/op-view.component';
import { type Col } from '../../shared/tables/data-table.component';
import { OpTableComponent } from '../../shared/tables/op-table.component';

const size = (b?: number) => (b == null ? '—' : b > 1_048_576 ? `${(b / 1_048_576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
const REASON = { reason: { textarea: true } };
const COLS: Col[] = [{ key: 'title' }, { key: 'categoryCode' }, { key: 'fileName', hidden: true }, { key: 'sizeBytes', fmt: size }, { key: 'status' }, { key: 'expiryDate' }, { key: 'versionNumber', hidden: true }, { key: 'createdAt', hidden: true }];
const OWNED: Col[] = [{ key: 'ownerEmployeeId' }, ...COLS];

/** Upload (multipart) with the category list from GET /documents/categories as a dropdown. */
@Component({
  selector: 'app-upload-button', standalone: true, imports: [OpButtonComponent, TranslateModule], changeDetection: ChangeDetectionStrategy.Default,
  template: `<app-op-button op="document.upload" [label]="'common.upload' | translate" icon="pi-upload" variant="primary" size="md" [query]="owner() ? { ownerEmployeeId: owner() } : undefined" [queryOverrides]="qo()" />`,
})
export class UploadButtonComponent {
  owner = input<string>(); cats = injectOp<any[]>('document.categories');
  qo = computed(() => ({ categoryCode: { options: (this.cats.data() ?? []).filter((x) => x.active !== false).map((x) => ({ value: x.code, label: x.name })) } }));
}

@Component({
  selector: 'app-doc-detail', standalone: true, changeDetection: ChangeDetectionStrategy.Default,
  imports: [ModalComponent, DetailComponent, OpViewComponent, OpButtonComponent, DownloadButtonComponent, CrudSectionComponent, LoadingBlockComponent],
  template: `<app-modal [open]="true" [title]="d()?.title ?? 'Document'" size="xl" (closed)="closed.emit()">
    @if (q.isLoading()) { <app-loading-block /> }
    @if (d(); as d) { <div class="d-grid gap-3"><app-detail [data]="d" [hide]="['id', 'sha256']" /><app-op-view op="document.versions" [path]="{ id: id() }" title="Versions" /><app-op-view op="document.history" [path]="{ id: id() }" title="Access & change history" />
      <app-crud-section title="Access permissions" [list]="{ op: 'document.permissions', path: { id: id() } }" [create]="{ op: 'document.grant', path: { id: id() } }" [remove]="{ op: 'document.revoke', path: pp }" /></div> }
    <ng-container footer>@if (d(); as d) { <app-download-button op="document.download" [path]="{ id: id() }" [filename]="d.fileName ?? 'document'" variant="outline" />
      @if (perm.canCall('document.verify') && d.status === 'UPLOADED') { <app-op-button op="document.verify" [path]="{ id: id() }" label="Verify" variant="success" size="md" /><app-op-button op="document.reject" [path]="{ id: id() }" label="Reject" variant="danger" size="md" [overrides]="rs" /> }
      @if (perm.canCall('document.approve') && d.status === 'VERIFIED') { <app-op-button op="document.approve" [path]="{ id: id() }" label="Approve" variant="success" size="md" /> } }</ng-container></app-modal>`,
})
export class DocDetailComponent {
  perm = inject(PermissionService); rs = REASON; id = input.required<string>(); closed = output<void>();
  q = injectOp<any>('document.get', () => ({ path: { id: this.id() } })); d = computed(() => this.q.data());
  pp = (r: any) => ({ id: this.id(), permissionId: r.id });
}

@Component({
  selector: 'app-docs-mine', standalone: true, changeDetection: ChangeDetectionStrategy.Default, imports: [CardComponent, OpTableComponent, DownloadButtonComponent, UploadButtonComponent, DocDetailComponent],
  template: `<app-card title="My documents"><app-upload-button actions /><app-op-table op="document.mine" tableId="docs-mine" [columns]="cols" [rowClickable]="true" (rowClick)="open.set($event.id)" [rowActions]="dl" /></app-card>
    @if (open(); as o) { <app-doc-detail [id]="o" (closed)="open.set(null)" /> }
    <ng-template #dl let-r><app-download-button op="document.download" [path]="{ id: r.id }" [filename]="r.fileName ?? 'document'" /></ng-template>`,
})
export class DocsMineComponent { open = signal<string | null>(null); cols = COLS; }

@Component({
  selector: 'app-docs-verification', standalone: true, changeDetection: ChangeDetectionStrategy.Default, imports: [FormsModule, TranslateModule, CardComponent, OpTableComponent, OpButtonComponent, DocDetailComponent],
  template: `<div class="d-grid gap-3"><app-card title="Pending verification"><app-op-table op="document.pending" tableId="docs-pending" [columns]="owned" [rowClickable]="true" (rowClick)="open.set($event.id)" [rowActions]="acts" /></app-card>
    <app-card title="Expiring documents"><input actions type="number" min="1" class="form-control" style="width:90px" [ngModel]="days()" (ngModelChange)="days.set(+$event || 30)" aria-label="days" /><app-op-table op="document.expiring" [query]="{ days: days() }" tableId="docs-expiring" [columns]="owned" [rowClickable]="true" (rowClick)="open.set($event.id)" /></app-card>
    @if (open(); as o) { <app-doc-detail [id]="o" (closed)="open.set(null)" /> }</div>
    <ng-template #acts let-r><app-op-button op="document.verify" [path]="{ id: r.id }" label="Verify" icon="pi-check" variant="success" /><app-op-button op="document.reject" [path]="{ id: r.id }" [label]="'common.reject' | translate" icon="pi-times" variant="danger" [overrides]="rs" /></ng-template>`,
})
export class DocsVerificationComponent { open = signal<string | null>(null); days = signal(30); owned = OWNED; rs = REASON; }

@Component({
  selector: 'app-docs-employee', standalone: true, changeDetection: ChangeDetectionStrategy.Default, imports: [CardComponent, EmployeeScopeComponent, OpTableComponent, UploadButtonComponent, DocDetailComponent],
  template: `<app-employee-scope><ng-template let-id><app-card title="Employee documents"><app-upload-button actions [owner]="id" /><app-op-table op="document.forEmployee" [path]="{ employeeId: id }" tableId="docs-emp" [columns]="cols" [rowClickable]="true" (rowClick)="open.set($event.id)" /></app-card></ng-template></app-employee-scope>
    @if (open(); as o) { <app-doc-detail [id]="o" (closed)="open.set(null)" /> }`,
})
export class DocsEmployeeComponent { open = signal<string | null>(null); cols = COLS; }

@Component({
  selector: 'app-documents-page', standalone: true, changeDetection: ChangeDetectionStrategy.Default,
  imports: [TranslateModule, PageHeaderComponent, TabsComponent, TabDirective, DocsMineComponent, DocsVerificationComponent, DocsEmployeeComponent, CrudSectionComponent],
  template: `<app-page-header [title]="'hr.documents.title' | translate" [subtitle]="'hr.documents.sub' | translate" />
  <app-tabs>
    <ng-template appTab="mine" [label]="'nav.myWorkspace' | translate" [hidden]="!perm.canCall('document.mine')"><app-docs-mine /></ng-template>
    <ng-template appTab="verify" label="Verification" [hidden]="!perm.canCall('document.pending')"><app-docs-verification /></ng-template>
    <ng-template appTab="employee" label="Employee documents" [hidden]="!perm.isAdmin()"><app-docs-employee /></ng-template>
    <ng-template appTab="categories" label="Categories"><app-crud-section title="Document categories" [list]="{ op: 'document.categories' }" [create]="{ op: 'document.createCategory' }" [update]="{ op: 'document.updateCategory', path: idp }" dialogSize="lg" /></ng-template>
  </app-tabs>`,
})
export class DocumentsPage { perm = inject(PermissionService); idp = (r: any) => ({ id: r.id }); }
export default DocumentsPage;
