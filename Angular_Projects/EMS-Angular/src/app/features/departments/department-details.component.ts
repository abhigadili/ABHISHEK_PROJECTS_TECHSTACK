import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { catchError, map, of, switchMap } from 'rxjs';
import { Department } from '../../core/models/organization.models';
import { DepartmentService } from '../../core/services/department.service';
import { EmployeeService } from '../../core/services/employee.service';
import { CellDirective, DataTableComponent, TableColumn } from '../../shared/components/data-table.component';
import { PageHeaderComponent, StatusBadgeComponent } from '../../shared/components/ui-basics';
import { HasPermissionDirective } from '../../shared/directives/directives';
import { EmployeeStatusPipe } from '../../shared/pipes/pipes';
import { ProfilePictureComponent } from '../../shared/components/profile-picture.component';

@Component({
  selector: 'app-department-details',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, DatePipe, MatButtonModule, MatCardModule, MatIconModule, PageHeaderComponent, DataTableComponent, CellDirective, StatusBadgeComponent, HasPermissionDirective, EmployeeStatusPipe, ProfilePictureComponent],
  template: `
    @if (current(); as d) {
      <div class="page">
        <app-page-header [title]="d.name" [subtitle]="d.code + (d.description ? ' · ' + d.description : '')">
          <a pageActions mat-stroked-button routerLink="/departments"><mat-icon>arrow_back</mat-icon> All departments</a>
          <a pageActions mat-flat-button [routerLink]="['edit']" *appHasPermission="'department.write'"><mat-icon>edit</mat-icon> Edit</a>
        </app-page-header>

        <div class="summary">
          <mat-card appearance="outlined"><mat-card-content><div class="k">Head</div><div class="v">
            @if (d.headEmployeeId) { <a [routerLink]="['/employees', d.headEmployeeId]">{{ d.headName }}</a> } @else { Not assigned }
          </div></mat-card-content></mat-card>
          <mat-card appearance="outlined"><mat-card-content><div class="k">Active employees</div><div class="v" data-testid="dept-headcount">{{ d.headcount }}</div></mat-card-content></mat-card>
          <mat-card appearance="outlined"><mat-card-content><div class="k">Status</div><div class="v"><app-status-badge [value]="d.isActive" [label]="d.isActive ? 'Active' : 'Inactive'" /></div></mat-card-content></mat-card>
          <mat-card appearance="outlined"><mat-card-content><div class="k">Created</div><div class="v">{{ d.createdAt.slice(0, 10) | date: 'mediumDate' }}</div></mat-card-content></mat-card>
        </div>

        <section class="panel">
          <h3>Teams</h3>
          @if (teams().length) {
            <ul class="teams">
              @for (t of teams(); track t.id) {
                <li><strong>{{ t.name }}</strong> <span class="muted">· {{ t.memberCount ?? 0 }} members</span></li>
              }
            </ul>
          } @else {
            <p class="muted">No teams in this department.</p>
          }
        </section>

        <section class="panel">
          <h3>Employees in {{ d.name }}</h3>
          <app-data-table testId="dept-employees" [columns]="columns" [rows]="employees().items" [meta]="employees().meta" [clickable]="true" emptyIcon="groups" emptyTitle="No employees in this department"
            (pageChange)="page.set($event.page)" (rowClick)="goto($event.id)">
            <ng-template appCell="fullName" let-e>
              <div class="who"><app-profile-picture [employeeId]="e.id" [hasPicture]="!!e.profilePictureUrl" [name]="e.fullName" [size]="28" /> {{ e.fullName }}</div>
            </ng-template>
            <ng-template appCell="jobTitle" let-e>{{ e.jobTitle ?? e.designation?.name ?? '—' }}</ng-template>
            <ng-template appCell="status" let-e><app-status-badge [value]="e.status" [label]="e.status | employeeStatus" /></ng-template>
          </app-data-table>
        </section>
      </div>
    }
  `,
  styles: `
    .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 16px; }
    .k { color: var(--ems-muted); font-size: 13px; }
    .v { font-size: 1.15rem; margin-top: 4px; }
    .panel { margin-bottom: 16px; }
    h3 { margin: 0 0 12px; font-weight: 500; }
    .teams { margin: 0; padding-left: 18px; }
    .who { display: flex; align-items: center; gap: 10px; }
  `,
})
export class DepartmentDetailsComponent {
  private readonly svc = inject(DepartmentService);
  private readonly employeeSvc = inject(EmployeeService);
  private readonly router = inject(Router);

  /** Route data `department` (resolver) bound to an input. */
  readonly department = input<Department | undefined>(undefined);
  protected readonly current = signal<Department | undefined>(undefined);
  protected readonly page = signal(1);

  protected readonly columns: TableColumn[] = [
    { key: 'employeeCode', label: 'Code' },
    { key: 'fullName', label: 'Name' },
    { key: 'jobTitle', label: 'Role' },
    { key: 'status', label: 'Status' },
  ];

  protected readonly teams = toSignal(
    toObservable(this.current).pipe(
      switchMap((d) => (d ? this.svc.teams(d.id).pipe(map((p) => p.items), catchError(() => of([]))) : of([]))),
    ),
    { initialValue: [] },
  );

  /** Employees of this department: association comes from the employee list filtered by departmentId. */
  protected readonly employees = toSignal(
    toObservable(computed(() => ({ d: this.current(), page: this.page() }))).pipe(
      switchMap(({ d, page }) =>
        d ? this.employeeSvc.list({ departmentId: d.id, status: 'ALL', page, limit: 10, sort: 'name:asc' }).pipe(catchError(() => of({ items: [], meta: null }))) : of({ items: [], meta: null }),
      ),
    ),
    { initialValue: { items: [], meta: null } },
  );

  constructor() {
    effect(() => {
      const d = this.department();
      untracked(() => this.current.set(d));
    });
  }

  protected goto(id: number): void {
    void this.router.navigate(['/employees', id]);
  }
}
