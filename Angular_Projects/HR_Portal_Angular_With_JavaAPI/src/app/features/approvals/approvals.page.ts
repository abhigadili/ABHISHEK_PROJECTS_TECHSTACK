import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { injectOp } from '../../api/queries/op-query';
import { PermissionService } from '../../core/services/permission.service';
import { BadgeComponent, CardComponent, EmptyStateComponent, PageHeaderComponent } from '../../shared/components/ui.components';
import { OpButtonComponent } from '../../shared/op/op-button.component';
import { type Col } from '../../shared/tables/data-table.component';
import type { Overrides } from '../../shared/forms/fields.component';
import { OpTableComponent } from '../../shared/tables/op-table.component';

const DEC = { comment: { rich: true } };
const DEC2 = { reason: { textarea: true } };
type V = 'success' | 'danger' | 'outline';
interface Act { op: string; label: string; variant: V; key?: string; ov?: Overrides; icon?: string }
interface Src { key: string; label: string; op: string; query?: Record<string, unknown>; cols: Col[]; actions: Act[] }
const A = (op: string, label: string, variant: V, key = 'id', ov: Overrides = DEC): Act => ({ op, label, variant, key, ov });

/** Every approval workflow discovered in the backend, as one inbox (a source is shown only when the user may call its pending-list endpoint). */
const SOURCES: Src[] = [
  { key: 'leave', label: 'Leave', op: 'leave.pending', cols: [{ key: 'employeeName' }, { key: 'leaveTypeName' }, { key: 'fromDate' }, { key: 'toDate' }, { key: 'days' }, { key: 'status' }], actions: [{ ...A('leave.approve', 'Approve', 'success'), icon: 'pi-check' }, { ...A('leave.reject', 'Reject', 'danger'), icon: 'pi-times' }] },
  { key: 'leaveCancel', label: 'Leave cancellations', op: 'leave.cancellationRequests', cols: [{ key: 'employeeName' }, { key: 'leaveTypeName' }, { key: 'fromDate' }, { key: 'toDate' }, { key: 'cancelReason' }], actions: [A('leave.approveCancellation', 'Approve', 'success'), A('leave.rejectCancellation', 'Reject', 'danger')] },
  { key: 'timesheet', label: 'Timesheets', op: 'timesheet.pending', cols: [{ key: 'employeeName' }, { key: 'weekStart' }, { key: 'totalHours' }, { key: 'billableHours' }], actions: [{ ...A('timesheet.approve', 'Approve', 'success'), icon: 'pi-check' }, { ...A('timesheet.reject', 'Reject', 'danger'), icon: 'pi-times' }] },
  { key: 'correction', label: 'Attendance corrections', op: 'attendance.pendingCorrections', cols: [{ key: 'employeeId' }, { key: 'workDate' }, { key: 'requestedCheckIn' }, { key: 'requestedCheckOut' }, { key: 'reason' }], actions: [A('attendance.approveCorrection', 'Approve', 'success'), A('attendance.rejectCorrection', 'Reject', 'danger')] },
  { key: 'wfh', label: 'Work from home', op: 'attendance.pendingWfh', cols: [{ key: 'employeeId' }, { key: 'fromDate' }, { key: 'toDate' }, { key: 'reason' }], actions: [A('attendance.approveWfh', 'Approve', 'success'), A('attendance.rejectWfh', 'Reject', 'danger')] },
  { key: 'review', label: 'Performance reviews', op: 'performance.pending', cols: [{ key: 'employeeName' }, { key: 'cycleId' }, { key: 'status' }], actions: [A('performance.approve', 'Approve', 'success'), A('performance.returnReview', 'Return', 'outline')] },
  { key: 'revision', label: 'Salary revisions', op: 'payroll.revisions', query: { status: 'PENDING' }, cols: [{ key: 'employeeId' }, { key: 'effectiveFrom' }, { key: 'newCtc' }, { key: 'status' }], actions: [A('payroll.approveRevision', 'Approve', 'success'), A('payroll.rejectRevision', 'Reject', 'danger')] },
  { key: 'tax', label: 'Tax declarations', op: 'tax.pending', cols: [{ key: 'employeeName' }, { key: 'financialYear' }, { key: 'regime' }, { key: 'totalDeclared' }, { key: 'status' }], actions: [A('tax.approve', 'Approve', 'success'), A('tax.reject', 'Reject', 'danger')] },
  { key: 'proof', label: 'Tax proofs', op: 'tax.proofsPending', cols: [{ key: 'fileName' }, { key: 'status' }], actions: [A('tax.verify', 'Verify', 'success', 'proofId', {}), A('tax.rejectProof', 'Reject', 'danger', 'proofId')] },
  { key: 'exit', label: 'Resignations', op: 'exit.pending', cols: [{ key: 'employeeName' }, { key: 'requestedLastWorkingDay' }, { key: 'reason' }], actions: [A('exit.managerDecision', 'Decide', 'outline')] },
  { key: 'document', label: 'Documents', op: 'document.pending', cols: [{ key: 'title' }, { key: 'categoryCode' }, { key: 'ownerEmployeeId' }], actions: [A('document.verify', 'Verify', 'success', 'id', {}), A('document.reject', 'Reject', 'danger', 'id', DEC2)] },
];

@Component({
  selector: 'app-approval-count', standalone: true, imports: [BadgeComponent], changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<app-badge [tone]="n() ? 'warning' : 'neutral'">{{ n() }}</app-badge>`,
})
export class ApprovalCountComponent {
  perm = inject(PermissionService); s = input.required<Src>();
  q = injectOp<any>(() => this.s().op, () => ({ query: this.s().query }), () => ({ enabled: this.perm.canCall(this.s().op), refetchInterval: 60_000 }));
  n = computed(() => { const d = this.q.data(); return Array.isArray(d) ? d.length : d?.totalElements ?? 0; });
}

@Component({
  selector: 'app-approvals-page', standalone: true, changeDetection: ChangeDetectionStrategy.Default,
  imports: [TranslateModule, PageHeaderComponent, CardComponent, EmptyStateComponent, OpTableComponent, OpButtonComponent, ApprovalCountComponent],
  template: `<app-page-header [title]="'hr.approvals.title' | translate" [subtitle]="'hr.approvals.sub' | translate" />
  @if (!avail().length) { <app-card><app-empty-state /></app-card> } @else {
    <div class="row g-3"><div class="col-12 col-lg-3"><div class="hr-card p-2">@for (s of avail(); track s.key) {
      <button type="button" (click)="sel.set(s.key)" class="mb-1 d-flex w-100 align-items-center justify-content-between rounded-2 border-0 px-3 py-2 text-start" style="font-size:13px" [style.background]="cur()?.key === s.key ? 'var(--hr-primary-soft)' : 'transparent'" [style.color]="cur()?.key === s.key ? 'var(--hr-primary)' : 'var(--hr-text)'" [style.fontWeight]="cur()?.key === s.key ? 600 : 400">{{ s.label }}<app-approval-count [s]="s" /></button> }</div></div>
      <div class="col-12 col-lg-9">@if (cur(); as c) { @for (k of [c.key]; track k) { <app-card [title]="c.label"><app-op-table [op]="c.op" [query]="c.query" [tableId]="'appr-' + c.key" [columns]="c.cols" [rowActions]="acts" /></app-card> } }</div></div> }
  <ng-template #acts let-r>@for (a of cur()!.actions; track a.op) { <app-op-button [op]="a.op" [path]="path(a, r)" [label]="a.label" [icon]="a.icon" [variant]="a.variant" [overrides]="a.ov" /> }</ng-template>`,
})
export class ApprovalsPage {
  perm = inject(PermissionService);
  avail = computed(() => { this.perm.user(); return SOURCES.filter((s) => this.perm.canCall(s.op)); });
  sel = signal(''); cur = computed<Src | undefined>(() => this.avail().find((s) => s.key === this.sel()) ?? this.avail()[0]);
  path = (a: Act, r: any) => ({ [a.key ?? 'id']: r.id });
}
export default ApprovalsPage;
