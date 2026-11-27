import { DatePipe, DecimalPipe, SlicePipe, TitleCasePipe, UpperCasePipe, LowerCasePipe, CurrencyPipe, I18nSelectPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { catchError, of, switchMap } from 'rxjs';
import { EmployeeService } from '../../core/services/employee.service';
import { EmployeeExtrasService, LOCAL_ONLY_NOTICE } from '../../core/services/employee-extras.service';
import { EmptyStateComponent, NoticeBannerComponent, StatusBadgeComponent } from '../../shared/components/ui-basics';
import { HasPermissionDirective, HasRoleDirective } from '../../shared/directives/directives';
import { EmploymentTypePipe } from '../../shared/pipes/pipes';
import { EmployeeDetailsState } from './employee-details.state';

/**
 * "Overview" tab. Doubles as the showcase for Angular's predefined pipes against real employee data:
 * date, currency, decimal, uppercase, lowercase, titlecase, slice, keyvalue, json, i18nSelect (+ async elsewhere).
 */
@Component({
  selector: 'app-employee-overview',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe, DecimalPipe, SlicePipe, TitleCasePipe, UpperCasePipe, LowerCasePipe, CurrencyPipe, I18nSelectPipe,
    RouterLink, MatButtonModule, HasPermissionDirective, HasRoleDirective, EmploymentTypePipe,
  ],
  template: `
    @if (e(); as emp) {
      <div class="form-grid sections">
        <section>
          <h3>Work</h3>
          <dl>
            <dt>Employee code</dt><dd>{{ emp.employeeCode | uppercase }}</dd>
            <dt>Work email</dt><dd>{{ emp.workEmail | lowercase }}</dd>
            <dt>Phone</dt><dd>{{ emp.phone || '—' }}</dd>
            <dt>Designation</dt><dd>{{ emp.designation?.name || '—' }}</dd>
            <dt>Department</dt><dd>@if (emp.department) { <a [routerLink]="['/departments', emp.department.id]">{{ emp.department.name }}</a> } @else { — }</dd>
            <dt>Team</dt><dd>{{ emp.team?.name || '—' }}</dd>
            <dt>Manager</dt><dd>@if (emp.manager) { <a [routerLink]="['/employees', emp.manager.id]">{{ emp.manager.name }}</a> } @else { — }</dd>
            <dt>Location</dt><dd>{{ emp.workLocation | titlecase }}</dd>
            <dt>Joined</dt><dd>{{ emp.joiningDate | date: 'longDate' }}</dd>
            <dt>Employment type</dt><dd>{{ emp.employmentType | employmentType }}</dd>
            <dt>Status</dt><dd>{{ emp.status | i18nSelect: statusText }}</dd>
          </dl>
          <a mat-stroked-button [routerLink]="['/organization', emp.id]">View in org chart</a>
        </section>

        <section>
          <h3>Personal & contact</h3>
          @if (emp.personalEmail !== undefined) {
            <dl>
              <dt>Personal email</dt><dd>{{ emp.personalEmail || '—' }}</dd>
              <dt>Date of birth</dt><dd>{{ emp.dateOfBirth ? (emp.dateOfBirth | date: 'mediumDate') : '—' }}</dd>
              <dt>Address</dt><dd>{{ addressText() }}</dd>
              <dt>Emergency contact</dt>
              <dd>{{ emp.emergencyContact?.name || '—' }} @if (emp.emergencyContact?.relation) { ({{ emp.emergencyContact?.relation }}) } {{ emp.emergencyContact?.phone }}</dd>
              <dt>Probation ends</dt><dd>{{ emp.probationEndDate ? (emp.probationEndDate | date: 'mediumDate') : '—' }}</dd>
              <dt>Last updated</dt><dd>{{ emp.updatedAt | slice: 0 : 16 }}</dd>
            </dl>
          } @else {
            <p class="muted">Personal details are visible to HR and the employee only.</p>
          }
        </section>

        <section *appHasPermission="'employee.salary.view'">
          <h3>Compensation</h3>
          @if (emp.compensation; as c) {
            <dl>
              <dt>Salary</dt><dd>{{ c.salary === null ? '—' : (c.salary | currency: c.salaryCurrency || 'USD') }}</dd>
              <dt>Bonus target</dt><dd>{{ c.bonusTarget === null ? '—' : (c.bonusTarget | currency: c.salaryCurrency || 'USD') }}</dd>
              <dt>Monthly (÷12)</dt><dd>{{ c.salary === null ? '—' : ((c.salary / 12) | number: '1.0-0') }}</dd>
            </dl>
          }
          <ng-container *appHasRole="['HR_ADMIN', 'SUPER_ADMIN']">
            <h3>Account</h3>
            <dl><dt>Login role</dt><dd data-testid="login-role">{{ emp.account?.role ?? 'No login account' }}</dd></dl>
          </ng-container>
        </section>
      </div>
    }
  `,
  styles: `
    section { min-width: 0; }
    h3 { margin: 0 0 8px; font-weight: 500; }
    dl { display: grid; grid-template-columns: 140px 1fr; gap: 6px 12px; margin: 0 0 12px; }
    dt { color: var(--ems-muted); font-size: 13px; }
    dd { margin: 0; overflow-wrap: anywhere; }
  `,
})
export class EmployeeOverviewComponent {
  protected readonly state = inject(EmployeeDetailsState);
  protected readonly e = this.state.employee;
  protected readonly statusText = { ACTIVE: 'Currently employed', INACTIVE: 'Inactive (deactivated)', TERMINATED: 'Terminated', other: 'Unknown' };
  protected readonly addressText = computed(() => {
    const a = this.e()?.address;
    return a ? [a.line, a.city, a.state, a.postalCode, a.country].filter(Boolean).join(', ') || '—' : '—';
  });
}

@Component({
  selector: 'app-employee-history',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, SlicePipe, EmptyStateComponent, StatusBadgeComponent],
  template: `
    <h3>Job history</h3>
    @if (loaded() && history().length === 0) {
      <app-empty-state icon="history" title="No job history yet" />
    }
    <ol class="timeline" data-testid="job-history">
      @for (h of history(); track h.id) {
        <li>
          <div class="dot"></div>
          <div class="card">
            <div class="top">
              <app-status-badge kind="info" [label]="h.changeType.replaceAll('_', ' ')" />
              <strong>{{ asDate(h.effectiveDate) | date: 'mediumDate' }}</strong>
            </div>
            @if (h.fromDesignation || h.toDesignation) { <div>Designation: {{ h.fromDesignation || '—' }} → <b>{{ h.toDesignation || '—' }}</b></div> }
            @if (h.fromJobTitle || h.toJobTitle) { <div>Job title: {{ h.fromJobTitle || '—' }} → <b>{{ h.toJobTitle || '—' }}</b></div> }
            @if (h.fromDepartment || h.toDepartment) { <div>Department: {{ h.fromDepartment || '—' }} → <b>{{ h.toDepartment || '—' }}</b></div> }
            @if (h.fromManager || h.toManager) { <div>Manager: {{ h.fromManager || '—' }} → <b>{{ h.toManager || '—' }}</b></div> }
            @if (h.notes) { <div class="muted">{{ h.notes | slice: 0 : 200 }}</div> }
          </div>
        </li>
      }
    </ol>
  `,
  styles: `
    h3 { margin: 0 0 12px; font-weight: 500; }
    .timeline { list-style: none; margin: 0; padding: 0 0 0 16px; border-left: 2px solid var(--ems-border); }
    li { position: relative; margin-bottom: 14px; padding-left: 16px; }
    .dot { position: absolute; left: -23px; top: 8px; width: 12px; height: 12px; border-radius: 50%; background: var(--ems-primary); }
    .card { background: var(--ems-surface-alt); border-radius: 8px; padding: 10px 14px; }
    .top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
  `,
})
export class EmployeeHistoryComponent {
  private readonly employees = inject(EmployeeService);
  private readonly state = inject(EmployeeDetailsState);
  private readonly route = inject(ActivatedRoute);
  /** Parent-route access: this tab lives at /employees/:id/history, so the :id param is two levels up (details shell → ':id' route). */
  private readonly routeEmployeeId = Number(this.route.parent?.parent?.snapshot.paramMap.get('id'));

  /** reload whenever the employee changes or a promotion/transfer bumps the version — switchMap drops stale responses */
  private readonly result = toSignal(
    toObservable(computed(() => ({ id: this.state.employee()?.id ?? (this.routeEmployeeId || undefined), v: this.state.historyVersion() }))).pipe(
      switchMap(({ id }) => (id ? this.employees.jobHistory(id).pipe(catchError(() => of(null))) : of(null))),
    ),
    { initialValue: undefined },
  );
  protected readonly history = computed(() => this.result() ?? []);
  protected readonly loaded = computed(() => this.result() !== undefined);
  protected asDate = (s: string) => new Date(`${s.slice(0, 10)}T00:00:00`);
}

@Component({
  selector: 'app-employee-background',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, MatButtonModule, MatChipsModule, MatIconModule, NoticeBannerComponent, HasPermissionDirective],
  template: `
    <app-notice-banner>{{ notice }}</app-notice-banner>
    @if (extras(); as x) {
      <h3>Education</h3>
      @for (ed of x.education; track $index) {
        <p><strong>{{ ed.degree }}</strong>{{ ed.fieldOfStudy ? ', ' + ed.fieldOfStudy : '' }} — {{ ed.institution }} ({{ ed.startYear ?? '?' }}–{{ ed.endYear ?? 'present' }}){{ ed.grade ? ' · ' + ed.grade : '' }}</p>
      } @empty {
        <p class="muted">No education records.</p>
      }
      <h3>Work experience</h3>
      @for (w of x.experience; track $index) {
        <p><strong>{{ w.role }}</strong> at {{ w.company }} ({{ w.startDate }} – {{ w.currentlyWorking ? 'present' : w.endDate }})<br /><span class="muted">{{ w.summary }}</span></p>
      } @empty {
        <p class="muted">No previous experience records.</p>
      }
      <h3>Skills & certifications</h3>
      <mat-chip-set>
        @for (s of x.skills; track $index) {
          <mat-chip>{{ s }}</mat-chip>
        } @empty {
          <span class="muted">No skills recorded.</span>
        }
      </mat-chip-set>
    }
    <p><a mat-stroked-button *appHasPermission="'employee.write'" [routerLink]="['../edit']"><mat-icon>edit</mat-icon> Edit in employee form</a></p>
  `,
  styles: `h3 { margin: 16px 0 8px; font-weight: 500; } p { margin: 6px 0; }`,
})
export class EmployeeBackgroundComponent {
  private readonly state = inject(EmployeeDetailsState);
  private readonly store = inject(EmployeeExtrasService);
  protected readonly notice = LOCAL_ONLY_NOTICE;
  protected readonly extras = computed(() => {
    const e = this.state.employee();
    return e ? this.store.get(e.id) : null;
  });
}
