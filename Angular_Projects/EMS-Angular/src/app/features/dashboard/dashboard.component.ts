import { NgComponentOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, Type, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { ChartConfiguration } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import { AppError } from '../../core/models/api.models';
import { AttendanceStatus } from '../../core/models/attendance.models';
import { DashboardBundle, DashboardService } from '../../core/services/dashboard.service';
import { PermissionService } from '../../core/services/permission.service';
import { AuthService } from '../../core/services/auth.service';
import { ErrorMessageComponent, EmptyStateComponent } from '../../shared/components/ui-basics';
import { PageHeaderComponent } from '../../shared/components/ui-basics';
import { ApprovalsWidgetComponent, BalancesWidgetComponent, EventsWidgetComponent } from './dashboard-widgets';

interface Stat {
  label: string;
  value: number;
  icon: string;
  link: string;
  testId: string;
}

interface WidgetSpec {
  id: string;
  component: Type<unknown>;
  inputs: Record<string, unknown>;
}

const STATUS_COLOURS: Record<AttendanceStatus, string> = {
  PRESENT: '#34a853', HALF_DAY: '#fbbc04', ABSENT: '#ea4335', ON_LEAVE: '#4285f4', HOLIDAY: '#9aa0a6', WEEKLY_OFF: '#bdc1c6',
};

/**
 * Dashboard. State lives in signals (data, loading, error); the HTTP orchestration is a single forkJoin in
 * DashboardService. Derived values (stat cards, chart data, widget list) are computed() — no duplicated state.
 */
@Component({
  selector: 'app-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgComponentOutlet, RouterLink, MatCardModule, MatIconModule, MatButtonModule, BaseChartDirective, PageHeaderComponent, ErrorMessageComponent, EmptyStateComponent],
  template: `
    <div class="page">
      <app-page-header [title]="greeting()" [subtitle]="subtitle()" />
      <app-error-message [error]="error()" (retry)="load()" />

      @if (data(); as d) {
        @if (stats().length) {
          <section class="stats" aria-label="Key figures">
            @for (s of stats(); track s.label) {
              <a class="stat panel" [routerLink]="s.link" [attr.data-testid]="s.testId">
                <mat-icon>{{ s.icon }}</mat-icon>
                <div><div class="value">{{ s.value }}</div><div class="label">{{ s.label }}</div></div>
              </a>
            }
          </section>
        }

        @if (d.overview) {
          <section class="charts">
            <mat-card appearance="outlined">
              <mat-card-header><mat-card-title>Headcount by department</mat-card-title></mat-card-header>
              <mat-card-content>
                @if (headcountChart().data.labels?.length) {
                  <canvas baseChart [data]="headcountChart().data" [options]="headcountChart().options" type="bar" aria-label="Headcount by department chart" role="img"></canvas>
                } @else {
                  <app-empty-state icon="bar_chart" title="No department data" />
                }
              </mat-card-content>
            </mat-card>
            <mat-card appearance="outlined">
              <mat-card-header><mat-card-title>Attendance today</mat-card-title></mat-card-header>
              <mat-card-content>
                @if (attendanceChart().data.labels?.length) {
                  <canvas baseChart [data]="attendanceChart().data" [options]="attendanceChart().options" type="doughnut" aria-label="Attendance today chart" role="img"></canvas>
                } @else {
                  <app-empty-state icon="schedule" title="No attendance recorded yet today" />
                }
              </mat-card-content>
            </mat-card>
          </section>
        }

        <section class="widgets">
          @for (w of widgets(); track w.id) {
            <ng-container *ngComponentOutlet="w.component; inputs: w.inputs" />
          }
        </section>
      } @else if (!error()) {
        <p class="muted" role="status">Loading dashboard…</p>
      }
    </div>
  `,
  styles: `
    .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 16px; margin-bottom: 24px; }
    .stat { display: flex; align-items: center; gap: 14px; text-decoration: none; color: inherit; }
    .stat mat-icon { font-size: 34px; width: 34px; height: 34px; color: var(--ems-primary); }
    .value { font-size: 1.8rem; font-weight: 500; line-height: 1; }
    .label { color: var(--ems-muted); font-size: 13px; margin-top: 4px; }
    .charts { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 16px; margin-bottom: 24px; }
    .charts mat-card-content { height: 300px; padding-top: 12px; position: relative; }
    .widgets { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 16px; }
  `,
})
export class DashboardComponent {
  private readonly dashboard = inject(DashboardService);
  private readonly permissions = inject(PermissionService);
  private readonly auth = inject(AuthService);

  protected readonly data = signal<DashboardBundle | null>(null);
  protected readonly error = signal<AppError | null>(null);

  protected readonly greeting = computed(() => `Welcome back, ${this.auth.profile()?.employee?.firstName ?? 'there'}`);
  protected readonly subtitle = computed(() => (this.data()?.overview ? `Organisation overview as of ${this.data()?.overview?.asOf}` : 'Your attendance and leave at a glance'));

  protected readonly stats = computed<Stat[]>(() => {
    const d = this.data();
    if (!d) return [];
    const o = d.overview;
    if (o) {
      return [
        { label: 'Total employees', value: o.employees.total, icon: 'groups', link: '/employees', testId: 'stat-total' },
        { label: 'Active', value: o.employees.active, icon: 'how_to_reg', link: '/employees', testId: 'stat-active' },
        { label: 'Inactive', value: o.employees.inactive, icon: 'person_off', link: '/employees', testId: 'stat-inactive' },
        { label: 'Present today', value: o.attendanceToday.PRESENT ?? 0, icon: 'login', link: '/attendance', testId: 'stat-present' },
        { label: 'On leave today', value: o.onLeaveToday, icon: 'beach_access', link: '/leaves', testId: 'stat-onleave' },
        { label: 'Pending approvals', value: o.pendingLeaveApprovals, icon: 'pending_actions', link: '/leaves/approvals', testId: 'stat-pending' },
      ];
    }
    return [
      { label: 'Days present this month', value: d.mySummary.byStatus.PRESENT ?? 0, icon: 'login', link: '/attendance', testId: 'stat-my-present' },
      { label: 'Leave days available', value: d.myBalances.balances.reduce((n, b) => n + b.available, 0), icon: 'beach_access', link: '/leaves', testId: 'stat-my-leave' },
    ];
  });

  protected readonly headcountChart = computed(() => {
    const rows = this.data()?.overview?.headcountByDepartment ?? [];
    const data: ChartConfiguration<'bar'>['data'] = {
      labels: rows.map((r) => r.department ?? 'Unassigned'),
      datasets: [{ data: rows.map((r) => r.headcount), label: 'Employees', backgroundColor: '#1a56c4', borderRadius: 4 }],
    };
    const options: ChartConfiguration<'bar'>['options'] = {
      responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
    };
    return { data, options };
  });

  protected readonly attendanceChart = computed(() => {
    const entries = Object.entries(this.data()?.overview?.attendanceToday ?? {}) as [AttendanceStatus, number][];
    const data: ChartConfiguration<'doughnut'>['data'] = {
      labels: entries.map(([k]) => k.replace('_', ' ')),
      datasets: [{ data: entries.map(([, v]) => v), backgroundColor: entries.map(([k]) => STATUS_COLOURS[k]) }],
    };
    const options: ChartConfiguration<'doughnut'>['options'] = { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } };
    return { data, options };
  });

  /** The widget set depends on role: managers+ see approvals and company events, everyone sees their own balances. */
  protected readonly widgets = computed<WidgetSpec[]>(() => {
    const d = this.data();
    if (!d) return [];
    const list: WidgetSpec[] = [];
    if (d.overview) {
      list.push({ id: 'approvals', component: ApprovalsWidgetComponent, inputs: { requests: d.pendingApprovals } });
      list.push({ id: 'birthdays', component: EventsWidgetComponent, inputs: { title: 'Upcoming birthdays', icon: 'cake', events: d.overview.upcomingBirthdays } });
      list.push({ id: 'anniversaries', component: EventsWidgetComponent, inputs: { title: 'Work anniversaries', icon: 'celebration', events: d.overview.upcomingAnniversaries } });
    }
    list.push({ id: 'balances', component: BalancesWidgetComponent, inputs: { balances: d.myBalances.balances } });
    return list;
  });

  constructor() {
    this.load();
  }

  protected load(): void {
    this.error.set(null);
    this.dashboard.load(this.permissions.has('dashboard.view')).subscribe({
      next: (bundle) => this.data.set(bundle),
      error: (e: AppError) => this.error.set(e),
    });
  }
}
