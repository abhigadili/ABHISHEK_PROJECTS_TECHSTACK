import { DatePipe, PercentPipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { LeaveBalance, LeaveRequest } from '../../core/models/leave.models';
import { UpcomingEvent } from '../../core/models/misc.models';
import { parseIsoDate } from '../../shared/utils/dates';
import { EmptyStateComponent } from '../../shared/components/ui-basics';

/**
 * Dashboard widgets are plain standalone components rendered by the dashboard with `ngComponentOutlet`
 * (dynamic component loading): the dashboard decides WHICH widgets exist for the current role; each widget
 * receives its data through signal inputs bound with `ngComponentOutletInputs`.
 */

@Component({
  selector: 'app-events-widget',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatCardModule, MatListModule, MatIconModule, DatePipe, EmptyStateComponent, RouterLink],
  template: `
    <mat-card appearance="outlined">
      <mat-card-header><mat-card-title><mat-icon class="ti">{{ icon() }}</mat-icon> {{ title() }}</mat-card-title></mat-card-header>
      <mat-card-content>
        <mat-list>
          @for (e of events(); track e.employeeId) {
            <mat-list-item>
              <a matListItemTitle [routerLink]="['/employees', e.employeeId]">{{ e.name }}</a>
              <span matListItemLine>{{ asDate(e.date) | date: 'EEE, MMM d' }}</span>
            </mat-list-item>
          } @empty {
            <app-empty-state [icon]="icon()" title="Nothing in the next 30 days" />
          }
        </mat-list>
      </mat-card-content>
    </mat-card>
  `,
  styles: `.ti { vertical-align: middle; margin-right: 6px; }`,
})
export class EventsWidgetComponent {
  readonly title = input('Upcoming');
  readonly icon = input('cake');
  readonly events = input<UpcomingEvent[]>([]);
  protected asDate = parseIsoDate;
}

@Component({
  selector: 'app-approvals-widget',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatCardModule, MatListModule, MatIconModule, DatePipe, RouterLink, EmptyStateComponent],
  template: `
    <mat-card appearance="outlined">
      <mat-card-header><mat-card-title><mat-icon class="ti">pending_actions</mat-icon> Pending leave approvals</mat-card-title></mat-card-header>
      <mat-card-content>
        <mat-list>
          @for (r of requests(); track r.id) {
            <mat-list-item>
              <a matListItemTitle [routerLink]="['/leaves', r.id]">{{ r.employeeName }} · {{ r.leaveType.name }}</a>
              <span matListItemLine>{{ asDate(r.startDate) | date: 'MMM d' }} – {{ asDate(r.endDate) | date: 'MMM d' }} ({{ r.days }}d)</span>
            </mat-list-item>
          } @empty {
            <app-empty-state icon="task_alt" title="No pending approvals" />
          }
        </mat-list>
      </mat-card-content>
      <mat-card-actions><a mat-button routerLink="/leaves/approvals">Open approvals</a></mat-card-actions>
    </mat-card>
  `,
  styles: `.ti { vertical-align: middle; margin-right: 6px; }`,
})
export class ApprovalsWidgetComponent {
  readonly requests = input<LeaveRequest[]>([]);
  protected asDate = parseIsoDate;
}

@Component({
  selector: 'app-balances-widget',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatCardModule, MatProgressBarModule, MatIconModule, DecimalPipe, PercentPipe, RouterLink, EmptyStateComponent],
  template: `
    <mat-card appearance="outlined">
      <mat-card-header><mat-card-title><mat-icon class="ti">beach_access</mat-icon> My leave balance</mat-card-title></mat-card-header>
      <mat-card-content>
        @for (b of rows(); track b.leaveTypeId) {
          <div class="bal">
            <div class="line"><span>{{ b.leaveTypeName }}</span><strong>{{ b.available | number: '1.0-1' }} / {{ b.total | number: '1.0-1' }}</strong></div>
            <mat-progress-bar mode="determinate" [value]="b.usedRatio * 100" [attr.aria-label]="b.leaveTypeName + ' used ' + (b.usedRatio | percent)" />
          </div>
        } @empty {
          <app-empty-state icon="event_busy" title="No leave balances yet" />
        }
      </mat-card-content>
      <mat-card-actions><a mat-button routerLink="/leaves/apply">Apply for leave</a></mat-card-actions>
    </mat-card>
  `,
  styles: `
    .ti { vertical-align: middle; margin-right: 6px; }
    .bal { margin-bottom: 14px; }
    .line { display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 14px; }
  `,
})
export class BalancesWidgetComponent {
  readonly balances = input<LeaveBalance[]>([]);
  /** Derived (computed) view-model — never stored separately from the input. */
  protected readonly rows = computed(() =>
    this.balances().map((b) => {
      const total = b.entitled + b.adjusted;
      return { ...b, total, usedRatio: total > 0 ? Math.min(1, b.used / total) : 0 };
    }),
  );
}
