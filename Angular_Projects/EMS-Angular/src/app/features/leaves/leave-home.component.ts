import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { catchError, map, of, startWith, switchMap, zip } from 'rxjs';
import { AppError, PageMeta } from '../../core/models/api.models';
import { LEAVE_STATUSES, LeaveRequest, LeaveStatus } from '../../core/models/leave.models';
import { LeaveService } from '../../core/services/leave.service';
import { PermissionService } from '../../core/services/permission.service';
import { ReferenceDataService } from '../../core/services/reference-data.service';
import { CellDirective, DataTableComponent, TableColumn } from '../../shared/components/data-table.component';
import { EmptyStateComponent, ErrorMessageComponent, PageHeaderComponent, StatusBadgeComponent } from '../../shared/components/ui-basics';
import { HasPermissionDirective } from '../../shared/directives/directives';
import { LeaveStatusPipe } from '../../shared/pipes/pipes';
import { parseIsoDate } from '../../shared/utils/dates';

interface Result { items: LeaveRequest[]; meta: PageMeta | null; error: AppError | null }

/** Leave home: balance summary cards (computed from the API result) + my request history with a status filter. */
@Component({
  selector: 'app-leave-home',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule, RouterLink, DatePipe, DecimalPipe, MatButtonModule, MatCardModule, MatFormFieldModule, MatIconModule, MatProgressBarModule, MatSelectModule,
    DataTableComponent, CellDirective, PageHeaderComponent, StatusBadgeComponent, ErrorMessageComponent, EmptyStateComponent, HasPermissionDirective, LeaveStatusPipe,
  ],
  template: `
    <div class="page">
      <app-page-header title="My leave" [subtitle]="'Balances for ' + year + ' and your request history'">
        <a pageActions mat-stroked-button routerLink="/leaves/approvals" *appHasPermission="'leave.approve'"><mat-icon>fact_check</mat-icon> Approvals</a>
        <a pageActions mat-stroked-button routerLink="/leaves/admin" *appHasPermission="'leave.admin'"><mat-icon>admin_panel_settings</mat-icon> Administration</a>
        <a pageActions mat-flat-button routerLink="/leaves/apply" data-testid="apply-leave"><mat-icon>add</mat-icon> Apply for leave</a>
      </app-page-header>

      <section class="balances" aria-label="Leave balances" data-testid="leave-balances">
        @for (b of cards(); track b.leaveTypeId) {
          <mat-card appearance="outlined">
            <mat-card-content>
              <div class="name">{{ b.leaveTypeName }}</div>
              <div class="avail"><span [attr.data-testid]="'available-' + b.leaveTypeCode">{{ b.available | number: '1.0-1' }}</span><small> / {{ b.total | number: '1.0-1' }} days</small></div>
              <mat-progress-bar mode="determinate" [value]="b.pct" />
              <div class="muted small">@if (b.isPaid !== null) { {{ b.isPaid ? 'Paid' : 'Unpaid' }} · }Used {{ b.used | number: '1.0-1' }}@if (b.adjusted) { · adjusted {{ b.adjusted > 0 ? '+' : '' }}{{ b.adjusted }} }</div>
            </mat-card-content>
          </mat-card>
        } @empty {
          <app-empty-state icon="event_busy" title="No leave balances" message="Balances appear once your account is linked to an employee record." />
        }
      </section>

      <div class="panel">
        <div class="toolbar-row">
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Status</mat-label>
            <mat-select [formControl]="status" data-testid="leave-status-filter">
              <mat-option [value]="null">All</mat-option>
              @for (s of statuses; track s) {
                <mat-option [value]="s">{{ s | leaveStatus }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
        </div>
        <app-error-message [error]="result().error" (retry)="status.setValue(status.value)" />
        <app-data-table testId="leave-table" [columns]="columns" [rows]="result().items" [meta]="result().meta" [clickable]="true" emptyIcon="beach_access" emptyTitle="No leave requests yet"
          (pageChange)="page.set($event.page); limit.set($event.limit)" (rowClick)="open($event)">
          <ng-template appCell="leaveType" let-r>{{ r.leaveType.name }}</ng-template>
          <ng-template appCell="period" let-r>{{ asDate(r.startDate) | date: 'MMM d' }}@if (r.startDate !== r.endDate) { – {{ asDate(r.endDate) | date: 'MMM d, y' }} } @else { , {{ asDate(r.startDate) | date: 'y' }} }</ng-template>
          <ng-template appCell="status" let-r><app-status-badge [value]="r.status" [label]="r.status | leaveStatus" /></ng-template>
          <ng-template appCell="reason" let-r><span class="clip">{{ r.reason }}</span></ng-template>
        </app-data-table>
      </div>
    </div>
  `,
  styles: `
    .balances { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; margin-bottom: 20px; }
    .name { color: var(--ems-muted); font-size: 13px; }
    .avail { font-size: 1.8rem; font-weight: 500; margin: 4px 0 8px; }
    .avail small { font-size: 0.9rem; color: var(--ems-muted); font-weight: 400; }
    .small { font-size: 12px; margin-top: 6px; }
    .clip { display: inline-block; max-width: 280px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; vertical-align: bottom; }
  `,
})
export class LeaveHomeComponent {
  private readonly svc = inject(LeaveService);
  private readonly router = inject(Router);
  protected readonly permissions = inject(PermissionService);

  protected readonly year = new Date().getFullYear();
  protected readonly statuses = LEAVE_STATUSES;
  protected readonly asDate = parseIsoDate;
  protected readonly status = new FormControl<LeaveStatus | null>(null);
  protected readonly page = signal(1);
  protected readonly limit = signal(10);
  private readonly statusValue = toSignal(this.status.valueChanges.pipe(startWith(null)), { initialValue: null });

  private readonly reference = inject(ReferenceDataService);
  /** zip pairs the two one-shot loads by emission order: balances + leave-type metadata (paid/unpaid) arrive together. */
  private readonly balances = toSignal(
    zip(this.svc.myBalances(this.year), this.reference.leaveTypes()).pipe(
      map(([b, types]) => b.balances.map((x) => ({ ...x, isPaid: types.find((t) => t.id === x.leaveTypeId)?.isPaid ?? null }))),
      catchError(() => of([])),
    ),
    { initialValue: [] },
  );
  /** View-model derived from the API data: totals and a "percent used" for the bar. */
  protected readonly cards = computed(() =>
    this.balances().map((b) => {
      const total = b.entitled + b.adjusted;
      return { ...b, total, pct: total > 0 ? Math.min(100, (b.used / total) * 100) : 0 };
    }),
  );

  protected readonly columns: TableColumn[] = [
    { key: 'leaveType', label: 'Type' },
    { key: 'period', label: 'Period' },
    { key: 'days', label: 'Days', align: 'end' },
    { key: 'status', label: 'Status' },
    { key: 'reason', label: 'Reason' },
  ];

  protected readonly result = toSignal(
    toObservable(computed(() => ({ status: this.statusValue(), page: this.page(), limit: this.limit() }))).pipe(
      switchMap((q) =>
        this.svc.mine(q).pipe(
          map((p): Result => ({ items: p.items, meta: p.meta, error: null })),
          catchError((error: AppError) => of<Result>({ items: [], meta: null, error })),
        ),
      ),
    ),
    { initialValue: { items: [], meta: null, error: null } as Result },
  );

  protected open(r: LeaveRequest): void {
    void this.router.navigate(['/leaves', r.id]);
  }
}
