import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { catchError, of, switchMap } from 'rxjs';
import { EmployeeService } from '../../core/services/employee.service';
import { EmptyStateComponent, PageHeaderComponent, StatusBadgeComponent } from '../../shared/components/ui-basics';
import { ProfilePictureComponent } from '../../shared/components/profile-picture.component';
import { EmployeeStatusPipe } from '../../shared/pipes/pipes';

@Component({
  selector: 'app-user-details',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, DatePipe, MatButtonModule, MatCardModule, MatIconModule, PageHeaderComponent, StatusBadgeComponent, EmptyStateComponent, ProfilePictureComponent, EmployeeStatusPipe],
  template: `
    <div class="page narrow">
      @if (employee(); as e) {
        <app-page-header [title]="e.fullName" subtitle="User account">
          <a pageActions mat-stroked-button routerLink="/users"><mat-icon>arrow_back</mat-icon> All users</a>
          <a pageActions mat-stroked-button [routerLink]="['/employees', e.id]"><mat-icon>badge</mat-icon> Employee record</a>
        </app-page-header>
        <mat-card appearance="outlined">
          <mat-card-content class="card">
            <app-profile-picture [employeeId]="e.id" [hasPicture]="!!e.profilePictureUrl" [name]="e.fullName" [size]="72" />
            <dl>
              <dt>Work e-mail (login)</dt><dd>{{ e.workEmail }}</dd>
              <dt>Role</dt><dd>@if (e.account) { <app-status-badge kind="info" [label]="e.account.role.replace('_', ' ')" /> } @else { No login account }</dd>
              <dt>Employee status</dt><dd><app-status-badge [value]="e.status" [label]="e.status | employeeStatus" /></dd>
              <dt>Department</dt><dd>{{ e.department?.name ?? '—' }}</dd>
              <dt>Joined</dt><dd>{{ e.joiningDate | date: 'mediumDate' }}</dd>
            </dl>
          </mat-card-content>
        </mat-card>
        @if (!e.account) {
          <p><a mat-flat-button routerLink="/users/new">Create login account</a></p>
        }
      } @else if (missing()) {
        <app-empty-state icon="person_off" title="User not found"><a mat-stroked-button routerLink="/users">Back to users</a></app-empty-state>
      }
    </div>
  `,
  styles: `.narrow { max-width: 720px; } .card { display: flex; gap: 24px; align-items: flex-start; flex-wrap: wrap; padding: 20px; } dl { display: grid; grid-template-columns: 160px 1fr; gap: 10px 16px; margin: 0; flex: 1; min-width: 260px; } dt { color: var(--ems-muted); } dd { margin: 0; }`,
})
export class UserDetailsComponent {
  private readonly employees = inject(EmployeeService);
  /** :employeeId delivered by input binding. */
  readonly employeeId = input.required<string>();
  private readonly loaded = toSignal(
    toObservable(this.employeeId).pipe(switchMap((id) => this.employees.get(Number(id)).pipe(catchError(() => of(null))))),
  ); // undefined = still loading, null = not found
  protected readonly employee = computed(() => this.loaded() ?? null);
  protected readonly missing = computed(() => this.loaded() === null);
}
