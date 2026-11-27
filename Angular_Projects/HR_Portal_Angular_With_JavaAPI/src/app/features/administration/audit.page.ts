import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { PermissionService } from '../../core/services/permission.service';
import { ModalComponent } from '../../shared/components/modal.component';
import { PageHeaderComponent } from '../../shared/components/ui.components';
import { DetailComponent } from '../../shared/components/value.components';
import { OpTableComponent } from '../../shared/tables/op-table.component';

export const SERVICES = ['auth', 'employee', 'organization', 'leave', 'attendance', 'holiday', 'payroll', 'tax', 'performance', 'project', 'timesheet', 'exit', 'document', 'notification', 'reporting'];

/** Audit history of every service (`<service>.searchAudit` - the operation id is built from the selected service). */
@Component({
  selector: 'app-audit-page', standalone: true, changeDetection: ChangeDetectionStrategy.Default, imports: [FormsModule, TranslateModule, PageHeaderComponent, OpTableComponent, ModalComponent, DetailComponent],
  template: `<app-page-header [title]="'hr.admin.audit' | translate" [subtitle]="'hr.admin.auditSub' | translate" />
  @for (s of [svc()]; track s) { <app-op-table [op]="s + '.searchAudit'" [tableId]="'audit-' + s" [query]="f()" defaultSort="createdAt,desc" [rowClickable]="true" (rowClick)="open.set($event)" [enabled]="perm.canCall(s + '.searchAudit')">
    <span filters class="contents"><select class="form-select" style="width:auto" [ngModel]="svc()" (ngModelChange)="svc.set($event)" aria-label="service">@for (x of services; track x) { <option>{{ x }}</option> }</select>
      <input class="form-control" style="width:150px" placeholder="entityType" [ngModel]="f().entityType" (ngModelChange)="set('entityType', $event)" aria-label="entityType" />
      <input class="form-control" style="width:180px" placeholder="entityId" [ngModel]="f().entityId" (ngModelChange)="set('entityId', $event)" aria-label="entityId" />
      <select class="form-select" style="width:auto" [ngModel]="f().action" (ngModelChange)="set('action', $event)" aria-label="action"><option value="">action</option>@for (a of actions; track a) { <option>{{ a }}</option> }</select></span></app-op-table> }
  <app-modal [open]="!!open()" title="Audit record" size="lg" (closed)="open.set(null)">@if (open(); as o) { <app-detail [data]="o" [hide]="['oldValue', 'newValue']" [cols]="2" />@for (k of ['oldValue', 'newValue']; track k) { @if (o[k]) { <div class="mt-3"><div class="field-label">{{ k }}</div><pre class="rounded-2 p-2" style="font-size:11px;white-space:pre-wrap;background:var(--hr-surface-2)">{{ pretty(o[k]) }}</pre></div> } } }</app-modal>`,
})
export class AuditPage {
  perm = inject(PermissionService); services = SERVICES; actions = ['CREATE', 'UPDATE', 'DELETE'];
  svc = signal('employee'); f = signal({ entityType: '', entityId: '', action: '' }); open = signal<any>(null);
  set(k: 'entityType' | 'entityId' | 'action', v: string) { this.f.set({ ...this.f(), [k]: v }); }
  pretty = (v: unknown) => (typeof v === 'string' ? v : JSON.stringify(v, null, 2));
  c = computed(() => 0);
}
export default AuditPage;
