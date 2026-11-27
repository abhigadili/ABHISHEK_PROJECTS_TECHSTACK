import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { catchError, map, of, startWith, switchMap } from 'rxjs';
import { AppError, PageMeta } from '../../core/models/api.models';
import { LeaveRequest } from '../../core/models/leave.models';
import { LeaveService } from '../../core/services/leave.service';
import { NotificationService } from '../../core/services/notification.service';
import { ToastService } from '../../core/services/toast.service';
import { CellDirective, DataTableComponent, TableColumn } from '../../shared/components/data-table.component';
import { DialogService } from '../../shared/components/dialogs';
import { ErrorMessageComponent, PageHeaderComponent } from '../../shared/components/ui-basics';
import { parseIsoDate } from '../../shared/utils/dates';

interface Result { items: LeaveRequest[]; meta: PageMeta | null; error: AppError | null }

/** Manager approval queue. Approve/reject go through the backend, which re-checks that the approver may decide. */
@Component({
  selector: 'app-leave-approvals',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, DatePipe, MatButtonModule, MatIconModule, DataTableComponent, CellDirective, PageHeaderComponent, ErrorMessageComponent],
  template: `
    <div class="page">
      <app-page-header title="Leave approvals" subtitle="Requests waiting for your decision">
        <a pageActions mat-stroked-button routerLink="/calendar" [queryParams]="{ view: 'leave' }"><mat-icon>event</mat-icon> Team calendar</a>
      </app-page-header>
      <div class="panel">
        <app-error-message [error]="result().error" (retry)="reload()" />
        <app-data-table testId="approvals-table" [columns]="columns" [rows]="result().items" [meta]="result().meta" [clickable]="true" emptyIcon="task_alt" emptyTitle="Nothing to approve" emptyMessage="You're all caught up."
          (pageChange)="page.set($event.page); limit.set($event.limit)" (rowClick)="open($event)">
          <ng-template appCell="leaveType" let-r>{{ r.leaveType.name }}</ng-template>
          <ng-template appCell="period" let-r>{{ asDate(r.startDate) | date: 'MMM d' }}@if (r.startDate !== r.endDate) { – {{ asDate(r.endDate) | date: 'MMM d' }} }</ng-template>
          <ng-template appCell="actions" let-r>
            <div class="row-actions" (click)="$event.stopPropagation()" (keydown.enter)="$event.stopPropagation()">
              <button mat-flat-button color="primary" type="button" (click)="approve(r)" [attr.data-testid]="'approve-' + r.id">Approve</button>
              <button mat-stroked-button color="warn" type="button" (click)="reject(r)" [attr.data-testid]="'reject-' + r.id">Reject</button>
            </div>
          </ng-template>
        </app-data-table>
      </div>
    </div>
  `,
})
export class LeaveApprovalsComponent {
  private readonly svc = inject(LeaveService);
  private readonly dialogs = inject(DialogService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly notifications = inject(NotificationService);

  protected readonly asDate = parseIsoDate;
  protected readonly page = signal(1);
  protected readonly limit = signal(10);
  private readonly tick = signal(0);

  protected readonly columns: TableColumn[] = [
    { key: 'employeeName', label: 'Employee' },
    { key: 'leaveType', label: 'Type' },
    { key: 'period', label: 'Period' },
    { key: 'days', label: 'Days', align: 'end' },
    { key: 'reason', label: 'Reason' },
    { key: 'actions', label: '', align: 'end' },
  ];

  protected readonly result = toSignal(
    toObservable(computed(() => ({ page: this.page(), limit: this.limit(), t: this.tick() }))).pipe(
      switchMap((q) =>
        this.svc.pendingApprovals(q).pipe(
          map((p): Result => ({ items: p.items, meta: p.meta, error: null })),
          catchError((error: AppError) => of<Result>({ items: [], meta: null, error })),
          startWith<Result | null>(null),
        ),
      ),
      map((r) => r ?? { items: [], meta: null, error: null }),
    ),
    { initialValue: { items: [], meta: null, error: null } as Result },
  );

  protected approve(r: LeaveRequest): void {
    this.dialogs.askReason({ title: 'Approve leave', message: `${r.employeeName}: ${r.leaveType.name}, ${r.days} day(s)`, label: 'Note (optional)', required: false, confirmLabel: 'Approve' }).subscribe((note) => {
      this.svc.approve(r.id, note).subscribe(() => this.done('Leave approved'));
    });
  }

  protected reject(r: LeaveRequest): void {
    this.dialogs.askReason({ title: 'Reject leave', message: `${r.employeeName}: ${r.leaveType.name}, ${r.days} day(s)`, label: 'Reason for rejection', confirmLabel: 'Reject', danger: true }).subscribe((note) => {
      this.svc.reject(r.id, note).subscribe(() => this.done('Leave rejected'));
    });
  }

  protected open(r: LeaveRequest): void {
    void this.router.navigate(['/leaves', r.id]);
  }

  protected reload(): void {
    this.tick.update((n) => n + 1);
  }

  private done(message: string): void {
    this.toast.success(message);
    this.notifications.refreshNow();
    this.reload();
  }
}
