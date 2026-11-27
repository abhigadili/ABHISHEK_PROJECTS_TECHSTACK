import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectChange, MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { catchError, map, of, startWith, switchMap } from 'rxjs';
import { AppError, PageMeta } from '../../core/models/api.models';
import { ALL_ROLES, Role } from '../../core/models/auth.models';
import { Employee } from '../../core/models/employee.models';
import { EmployeeService } from '../../core/services/employee.service';
import { PermissionService } from '../../core/services/permission.service';
import { ToastService } from '../../core/services/toast.service';
import { CellDirective, DataTableComponent, TableColumn } from '../../shared/components/data-table.component';
import { DialogService } from '../../shared/components/dialogs';
import { SearchBoxComponent } from '../../shared/components/search-box.component';
import { ErrorMessageComponent, PageHeaderComponent, StatusBadgeComponent } from '../../shared/components/ui-basics';
import { EmployeeStatusPipe } from '../../shared/pipes/pipes';

interface Result { items: Employee[]; meta: PageMeta | null; error: AppError | null }

/**
 * Users & roles. The backend has no /users collection: a login account belongs to an employee, and admins receive
 * `account` (userId + role) on every employee. So this screen is the employee directory viewed through its accounts.
 */
@Component({
  selector: 'app-user-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, MatButtonModule, MatFormFieldModule, MatIconModule, MatSelectModule, MatSlideToggleModule, MatTooltipModule, DataTableComponent, CellDirective, SearchBoxComponent, PageHeaderComponent, ErrorMessageComponent, StatusBadgeComponent, EmployeeStatusPipe],
  template: `
    <div class="page">
      <app-page-header title="Users & roles" subtitle="Login accounts, role assignment and activation">
        <a pageActions mat-flat-button routerLink="/users/new" data-testid="new-account"><mat-icon>person_add</mat-icon> Create account</a>
      </app-page-header>
      <div class="panel">
        <div class="toolbar-row">
          <div class="grow"><app-search-box label="Search users" placeholder="Name, e-mail or code" (searchChange)="q.set($event); page.set(1)" /></div>
          <mat-slide-toggle [checked]="onlyAccounts()" (change)="onlyAccounts.set($event.checked)">Only with login account</mat-slide-toggle>
        </div>
        <app-error-message [error]="result().error" (retry)="reload()" />
        <app-data-table testId="user-table" [columns]="columns" [rows]="rows()" [meta]="result().meta" [clickable]="true" emptyIcon="admin_panel_settings" emptyTitle="No users found"
          (pageChange)="page.set($event.page); limit.set($event.limit)" (rowClick)="open($event)">
          <ng-template appCell="fullName" let-e><strong>{{ e.fullName }}</strong><div class="muted">{{ e.workEmail }}</div></ng-template>
          <ng-template appCell="role" let-e>
            <div (click)="$event.stopPropagation()" (keydown.enter)="$event.stopPropagation()">
              @if (!e.account) {
                <span class="muted">No account</span>
              } @else if (permissions.has('role.assign')) {
                <mat-form-field appearance="outline" subscriptSizing="dynamic" class="role-select">
                  <mat-select [value]="e.account.role" (selectionChange)="changeRole(e, $event)" [attr.aria-label]="'Role for ' + e.fullName">
                    @for (r of roles; track r) { <mat-option [value]="r">{{ r.replace('_', ' ') }}</mat-option> }
                  </mat-select>
                </mat-form-field>
              } @else {
                <app-status-badge kind="info" [label]="e.account.role.replace('_', ' ')" />
              }
            </div>
          </ng-template>
          <ng-template appCell="status" let-e><app-status-badge [value]="e.status" [label]="e.status | employeeStatus" /></ng-template>
          <ng-template appCell="actions" let-e>
            <div class="row-actions" (click)="$event.stopPropagation()" (keydown.enter)="$event.stopPropagation()">
              @if (e.status === 'ACTIVE') {
                <button mat-icon-button type="button" matTooltip="Deactivate (blocks login)" aria-label="Deactivate user" (click)="deactivate(e)"><mat-icon>person_off</mat-icon></button>
              } @else {
                <button mat-icon-button type="button" matTooltip="Reactivate" aria-label="Reactivate user" (click)="reactivate(e)"><mat-icon>person_check</mat-icon></button>
              }
            </div>
          </ng-template>
        </app-data-table>
      </div>
    </div>
  `,
  styles: `.grow { flex: 1 1 260px; } .role-select { width: 180px; }`,
})
export class UserListComponent {
  private readonly employees = inject(EmployeeService);
  private readonly router = inject(Router);
  private readonly dialogs = inject(DialogService);
  private readonly toast = inject(ToastService);
  protected readonly permissions = inject(PermissionService);

  protected readonly roles = ALL_ROLES;
  protected readonly q = signal('');
  protected readonly page = signal(1);
  protected readonly limit = signal(10);
  protected readonly onlyAccounts = signal(false);
  protected readonly tick = signal(0);

  protected readonly columns: TableColumn[] = [
    { key: 'fullName', label: 'User' },
    { key: 'employeeCode', label: 'Code' },
    { key: 'role', label: 'Role' },
    { key: 'status', label: 'Status' },
    { key: 'actions', label: '', align: 'end' },
  ];

  protected readonly result = toSignal(
    toObservable(computed(() => ({ q: this.q(), page: this.page(), limit: this.limit(), t: this.tick() }))).pipe(
      switchMap(({ q, page, limit }) =>
        this.employees.list({ q, page, limit, status: 'ALL', sort: 'name:asc' }).pipe(
          map((p): Result => ({ items: p.items, meta: p.meta, error: null })),
          catchError((error: AppError) => of<Result>({ items: [], meta: null, error })),
          startWith<Result | null>(null),
        ),
      ),
      map((r) => r ?? { items: [], meta: null, error: null }),
    ),
    { initialValue: { items: [], meta: null, error: null } as Result },
  );
  protected readonly rows = computed(() => (this.onlyAccounts() ? this.result().items.filter((e) => !!e.account) : this.result().items));

  protected reload(): void {
    this.tick.update((n) => n + 1);
  }

  protected open(e: Employee): void {
    void this.router.navigate(['/users', e.id]);
  }

  protected changeRole(e: Employee, change: MatSelectChange): void {
    const role = change.value as Role;
    const previous = e.account?.role;
    let confirmed = false;
    this.dialogs.confirm({ title: 'Change role?', message: `${e.fullName} will become ${role.replace('_', ' ')}.`, confirmLabel: 'Change role', danger: role === 'SUPER_ADMIN' }).subscribe({
      next: () => {
        confirmed = true;
        this.employees.setRole(e.id, role).subscribe({
          next: () => { this.toast.success('Role updated'); this.tick.update((n) => n + 1); },
          error: () => { change.source.value = previous; },
        });
      },
      complete: () => { if (!confirmed) change.source.value = previous; }, // dialog dismissed → put the select back
    });
  }

  protected deactivate(e: Employee): void {
    this.dialogs.askReason({ title: `Deactivate ${e.fullName}?`, label: 'Reason (optional)', required: false, confirmLabel: 'Deactivate', danger: true }).subscribe((reason) => {
      this.employees.deactivate(e.id, { reason: reason || undefined }).subscribe(() => { this.toast.success('User deactivated'); this.tick.update((n) => n + 1); });
    });
  }

  protected reactivate(e: Employee): void {
    this.employees.reactivate(e.id).subscribe(() => { this.toast.success('User reactivated'); this.tick.update((n) => n + 1); });
  }
}
