import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { catchError, of, switchMap, tap } from 'rxjs';
import { LeaveRequest } from '../../core/models/leave.models';
import { AuthService } from '../../core/services/auth.service';
import { LeaveService } from '../../core/services/leave.service';
import { NotificationService } from '../../core/services/notification.service';
import { PermissionService } from '../../core/services/permission.service';
import { ToastService } from '../../core/services/toast.service';
import { DialogService } from '../../shared/components/dialogs';
import { FileUploadComponent } from '../../shared/components/file-upload.component';
import { EmptyStateComponent, PageHeaderComponent, StatusBadgeComponent } from '../../shared/components/ui-basics';
import { LeaveStatusPipe, ServerDateTimePipe } from '../../shared/pipes/pipes';
import { downloadBlob } from '../../shared/utils/download';
import { parseIsoDate } from '../../shared/utils/dates';

/** Leave request details with the actions each viewer is entitled to see (owner: cancel/attach; manager: approve/reject). */
@Component({
  selector: 'app-leave-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, DatePipe, MatButtonModule, MatCardModule, MatIconModule, PageHeaderComponent, StatusBadgeComponent, EmptyStateComponent, FileUploadComponent, LeaveStatusPipe, ServerDateTimePipe],
  template: `
    <div class="page narrow">
      @if (request(); as r) {
        <app-page-header [title]="r.leaveType.name + ' · ' + r.days + ' day' + (r.days === 1 ? '' : 's')" [subtitle]="r.employeeName + ' (' + r.employeeCode + ')'">
          <a pageActions mat-stroked-button [routerLink]="backLink()"><mat-icon>arrow_back</mat-icon> Back</a>
        </app-page-header>
        <mat-card appearance="outlined">
          <mat-card-content>
            <dl>
              <dt>Status</dt><dd><app-status-badge [value]="r.status" [label]="r.status | leaveStatus" /></dd>
              <dt>Dates</dt><dd>{{ asDate(r.startDate) | date: 'fullDate' }}@if (r.startDate !== r.endDate) { → {{ asDate(r.endDate) | date: 'fullDate' }} }</dd>
              <dt>Day part</dt><dd>{{ r.dayPart.replace('_', ' ') }}</dd>
              <dt>Reason</dt><dd>{{ r.reason }}</dd>
              <dt>Submitted</dt><dd>{{ r.createdAt | serverDateTime }}</dd>
              @if (r.decidedAt) {
                <dt>Decision</dt><dd>{{ r.decidedAt | serverDateTime }}@if (r.decisionNote) { — “{{ r.decisionNote }}” }</dd>
              }
              @if (r.cancelledAt) {
                <dt>Cancelled</dt><dd>{{ r.cancelledAt | serverDateTime }}</dd>
              }
            </dl>

            <h3>Documents</h3>
            @for (d of r.documents ?? []; track d.id) {
              <button mat-stroked-button type="button" (click)="download(r, d.id, d.fileName)"><mat-icon>description</mat-icon> {{ d.fileName ?? 'Document ' + d.id }}</button>
            } @empty {
              <p class="muted">No documents attached.</p>
            }
            @if (isOwner() && r.status === 'PENDING') {
              <div class="upload"><app-file-upload label="Attach document" icon="attach_file" [accept]="docTypes" [maxBytes]="2097152" (fileSelected)="upload(r, $event)" /></div>
            }

            <div class="actions">
              @if (canDecide(r)) {
                <button mat-flat-button color="primary" type="button" (click)="approve(r)" data-testid="approve">Approve</button>
                <button mat-stroked-button color="warn" type="button" (click)="reject(r)" data-testid="reject">Reject</button>
              }
              @if (canCancel(r)) {
                <button mat-stroked-button color="warn" type="button" (click)="cancel(r)" data-testid="cancel-leave">Cancel request</button>
              }
            </div>
          </mat-card-content>
        </mat-card>
      } @else if (missing()) {
        <app-empty-state icon="event_busy" title="Request not found" message="It may not exist or you may not have access."><a mat-stroked-button routerLink="/leaves">My leave</a></app-empty-state>
      }
    </div>
  `,
  styles: `
    .narrow { max-width: 760px; }
    dl { display: grid; grid-template-columns: 140px 1fr; gap: 10px 16px; margin: 0 0 16px; }
    dt { color: var(--ems-muted); } dd { margin: 0; }
    h3 { margin: 16px 0 8px; font-weight: 500; }
    .upload { margin-top: 12px; }
    .actions { display: flex; gap: 8px; margin-top: 20px; flex-wrap: wrap; }
  `,
})
export class LeaveDetailComponent {
  private readonly svc = inject(LeaveService);
  private readonly auth = inject(AuthService);
  private readonly permissions = inject(PermissionService);
  private readonly dialogs = inject(DialogService);
  private readonly toast = inject(ToastService);
  private readonly notifications = inject(NotificationService);

  /** `:id` bound to an input by the router. */
  readonly id = input.required<string>();
  private readonly version = signal(0);
  protected readonly missing = signal(false);
  protected readonly asDate = parseIsoDate;
  protected readonly docTypes = ['image/jpeg', 'image/png', 'application/pdf'];

  protected readonly request = toSignal(
    toObservable(computed(() => ({ id: Number(this.id()), v: this.version() }))).pipe(
      switchMap(({ id }) =>
        this.svc.get(id).pipe(
          tap(() => this.missing.set(false)),
          catchError(() => {
            this.missing.set(true);
            return of(null);
          }),
        ),
      ),
    ),
    { initialValue: null },
  );

  protected readonly isOwner = computed(() => this.request()?.employeeId === this.auth.employeeId());
  protected readonly backLink = computed(() => (this.isOwner() ? '/leaves' : this.permissions.has('leave.approve') ? '/leaves/approvals' : '/leaves'));

  protected canDecide(r: LeaveRequest): boolean {
    return r.status === 'PENDING' && this.permissions.has('leave.approve') && !this.isOwner();
  }

  protected canCancel(r: LeaveRequest): boolean {
    return (r.status === 'PENDING' || r.status === 'APPROVED') && (this.isOwner() || this.permissions.has('leave.admin'));
  }

  protected approve(r: LeaveRequest): void {
    this.dialogs.askReason({ title: 'Approve leave', message: `Approve ${r.employeeName}'s request?`, label: 'Note (optional)', required: false, confirmLabel: 'Approve' }).subscribe((note) => {
      this.svc.approve(r.id, note).subscribe(() => this.done('Leave approved'));
    });
  }

  protected reject(r: LeaveRequest): void {
    this.dialogs.askReason({ title: 'Reject leave', label: 'Reason for rejection', confirmLabel: 'Reject', danger: true }).subscribe((note) => {
      this.svc.reject(r.id, note).subscribe(() => this.done('Leave rejected'));
    });
  }

  protected cancel(r: LeaveRequest): void {
    this.dialogs.askReason({ title: 'Cancel leave request', label: 'Reason (optional)', required: false, confirmLabel: 'Cancel request', danger: true }).subscribe((note) => {
      this.svc.cancel(r.id, note).subscribe(() => this.done('Leave request cancelled'));
    });
  }

  protected upload(r: LeaveRequest, file: File): void {
    this.svc.uploadDocument(r.id, file).subscribe(() => this.done('Document attached'));
  }

  protected download(r: LeaveRequest, docId: number, name?: string): void {
    this.svc.downloadDocument(r.id, docId).subscribe((blob) => downloadBlob(blob, name ?? `leave-${r.id}-document-${docId}`));
  }

  private done(message: string): void {
    this.toast.success(message);
    this.notifications.refreshNow();
    this.version.update((v) => v + 1);
  }
}
