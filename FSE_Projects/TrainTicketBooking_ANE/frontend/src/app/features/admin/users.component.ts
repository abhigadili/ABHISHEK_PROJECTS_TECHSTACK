import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatSelectModule } from '@angular/material/select';
import { combineLatest, finalize, startWith, map } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { ROLE_KEYS, ROLE_LABEL } from '../../core/auth/permissions';
import type { RoleKey, User } from '../../core/models/models';
import { UserService } from '../../core/services/account.services';
import { toApiError } from '../../core/interceptors/error.interceptor';
import { ToastService } from '../../core/services/toast.service';
import { Column, DataTableComponent } from '../../shared/components/data-table.component';
import { ConfirmService, FieldErrorComponent, PageHeaderComponent } from '../../shared/components/ui.components';
import { CanDirective, DigitsOnlyDirective } from '../../shared/directives/directives';
import { listState } from '../../shared/list-state';
import { applyServerErrors, indianMobile } from '../../shared/validators/validators';

@Component({
  selector: 'app-user-dialog', imports: [ReactiveFormsModule, MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule, FieldErrorComponent, DigitsOnlyDirective], changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<h2 mat-dialog-title>Edit {{ data.email }}</h2><form [formGroup]="form" (ngSubmit)="save()" novalidate><mat-dialog-content class="dc">
    <mat-form-field><mat-label>Name</mat-label><input matInput formControlName="name" /><mat-error><app-field-error [control]="form.controls.name" label="Name" /></mat-error></mat-form-field>
    <mat-form-field><mat-label>Mobile</mat-label><input matInput formControlName="mobile" maxlength="10" appDigitsOnly /><mat-error><app-field-error [control]="form.controls.mobile" label="Mobile" /></mat-error></mat-form-field>
    @if (error()) { <p class="err" role="alert">{{ error() }}</p> }</mat-dialog-content>
    <mat-dialog-actions align="end"><button mat-button type="button" mat-dialog-close>Cancel</button><button mat-flat-button type="submit" [disabled]="busy()">Save</button></mat-dialog-actions></form>`,
  styles: [`.dc{display:flex;flex-direction:column;min-width:min(380px,80vw)}`],
})
export class UserDialogComponent {
  private readonly api = inject(UserService); private readonly ref = inject(MatDialogRef<UserDialogComponent>); private readonly fb = inject(NonNullableFormBuilder);
  readonly data = inject<User>(MAT_DIALOG_DATA); readonly busy = signal(false); readonly error = signal('');
  readonly form = this.fb.group({ name: [this.data.name, [Validators.required, Validators.minLength(2)]], mobile: [this.data.mobile, [Validators.required, indianMobile]] });
  save() { this.form.markAllAsTouched(); if (this.form.invalid) return; this.busy.set(true); this.api.update(this.data.id, this.form.getRawValue()).pipe(finalize(() => this.busy.set(false))).subscribe({ next: (u) => this.ref.close(u), error: (e) => { const er = toApiError(e); applyServerErrors(this.form, er.fields); this.error.set(er.message); } }); }
}

@Component({
  selector: 'app-roles-dialog', imports: [MatDialogModule, MatButtonModule, MatCheckboxModule], changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<h2 mat-dialog-title>Roles · {{ data.name }}</h2><mat-dialog-content>
    @for (r of roles; track r) { <div><mat-checkbox [checked]="sel().includes(r)" (change)="toggle(r, $event.checked)">{{ label[r] }}</mat-checkbox></div> }
    @if (error()) { <p class="err" role="alert">{{ error() }}</p> }</mat-dialog-content>
    <mat-dialog-actions align="end"><button mat-button mat-dialog-close>Cancel</button><button mat-flat-button [disabled]="!sel().length || busy()" (click)="save()">Save</button></mat-dialog-actions>`,
})
export class RolesDialogComponent {
  private readonly api = inject(UserService); private readonly ref = inject(MatDialogRef<RolesDialogComponent>);
  readonly data = inject<User>(MAT_DIALOG_DATA); readonly roles = ROLE_KEYS; readonly label = ROLE_LABEL;
  readonly sel = signal<RoleKey[]>([...this.data.roles]); readonly busy = signal(false); readonly error = signal('');
  toggle(r: RoleKey, on: boolean) { this.sel.update((s) => (on ? [...new Set([...s, r])] : s.filter((x) => x !== r))); }
  save() { this.busy.set(true); this.api.setRoles(this.data.id, this.sel()).pipe(finalize(() => this.busy.set(false))).subscribe({ next: (u) => this.ref.close(u), error: (e) => this.error.set(toApiError(e).message) }); }
}

@Component({
  selector: 'app-users', imports: [ReactiveFormsModule, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule, MatMenuModule, MatSelectModule, MatDialogModule, DataTableComponent, PageHeaderComponent, CanDirective], changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header title="Users" subtitle="Accounts, roles and status" />
    <div class="card row" style="margin-bottom:16px">
      <mat-form-field style="flex:2;min-width:200px"><mat-label>Search name, e-mail or mobile</mat-label><mat-icon matPrefix>search</mat-icon><input matInput [formControl]="l.search" /></mat-form-field>
      <mat-form-field style="flex:1;min-width:150px"><mat-label>Role</mat-label><mat-select [formControl]="role"><mat-option value="">All</mat-option>@for (r of roleKeys; track r) { <mat-option [value]="r">{{ label[r] }}</mat-option> }</mat-select></mat-form-field>
      <mat-form-field style="flex:1;min-width:150px"><mat-label>Status</mat-label><mat-select [formControl]="status"><mat-option value="">All</mat-option><mat-option value="ACTIVE">Active</mat-option><mat-option value="SUSPENDED">Suspended</mat-option><mat-option value="PENDING">Pending</mat-option></mat-select></mat-form-field>
    </div>
    <app-data-table [columns]="columns" [rows]="l.rows()" [meta]="l.meta()" [loading]="l.loading()" [error]="l.error()" [sortActive]="l.sortActive" [sortDir]="l.sortDir" (pageChange)="l.page$.next($event)" (sortChange)="l.sort$.next($event)" (retry)="l.reload()">
      <ng-template #actions let-u>
        <ng-container *appCan="'user:manage'">
          <button mat-icon-button [matMenuTriggerFor]="m" [attr.aria-label]="'Actions for ' + u.name"><mat-icon>more_vert</mat-icon></button>
          <mat-menu #m="matMenu">
            <button mat-menu-item (click)="edit(u)"><mat-icon>edit</mat-icon>Edit details</button>
            <button mat-menu-item (click)="roles(u)"><mat-icon>admin_panel_settings</mat-icon>Roles</button>
            @if (u.status === 'ACTIVE') { <button mat-menu-item (click)="setStatus(u, 'SUSPENDED')" [disabled]="u.id === auth.user()?.id"><mat-icon>block</mat-icon>Suspend</button> } @else { <button mat-menu-item (click)="setStatus(u, 'ACTIVE')"><mat-icon>check_circle</mat-icon>Activate</button> }
            <button mat-menu-item (click)="remove(u)" [disabled]="u.id === auth.user()?.id"><mat-icon>delete</mat-icon>Delete</button>
          </mat-menu>
        </ng-container>
      </ng-template>
    </app-data-table>`,
})
export class UsersComponent {
  private readonly api = inject(UserService); private readonly dialog = inject(MatDialog); private readonly toast = inject(ToastService); private readonly confirm = inject(ConfirmService);
  readonly auth = inject(AuthService); readonly roleKeys = ROLE_KEYS; readonly label = ROLE_LABEL;
  readonly role = new FormControl('', { nonNullable: true }); readonly status = new FormControl('', { nonNullable: true });
  /** Filters: role + status merge into one observable of query params. */
  readonly l = listState<User>((q) => this.api.list(q), { sort: 'createdAt', dir: 'desc' },
    combineLatest([this.role.valueChanges.pipe(startWith('')), this.status.valueChanges.pipe(startWith(''))]).pipe(map(([role, status]) => ({ role, status }))));
  readonly columns: Column<User>[] = [
    { key: 'name', label: 'Name', sortable: true }, { key: 'email', label: 'E-mail', sortable: true }, { key: 'mobile', label: 'Mobile' },
    { key: 'roles', label: 'Roles', value: (u) => u.roles.map((r) => ROLE_LABEL[r]).join(', ') }, { key: 'status', label: 'Status', kind: 'chip' },
    { key: 'lastLoginAt', label: 'Last login', kind: 'datetime', sortable: true }, { key: 'createdAt', label: 'Joined', kind: 'date', sortable: true },
  ];
  edit(u: User) { this.dialog.open(UserDialogComponent, { data: u }).afterClosed().subscribe((r) => { if (r) { this.toast.success('User updated.'); this.l.reload(); } }); }
  roles(u: User) { this.dialog.open(RolesDialogComponent, { data: u }).afterClosed().subscribe((r) => { if (r) { this.toast.success('Roles updated. The user must sign in again.'); this.l.reload(); } }); }
  async setStatus(u: User, s: User['status']) { if (s === 'SUSPENDED' && !(await this.confirm.ask({ title: 'Suspend user?', message: `${u.name} will be signed out and unable to sign in.`, confirmText: 'Suspend', danger: true }))) return; this.api.setStatus(u.id, s).subscribe({ next: () => { this.toast.success('Status updated.'); this.l.reload(); }, error: (e) => this.toast.error(toApiError(e).message) }); }
  async remove(u: User) { if (await this.confirm.ask({ title: 'Delete user?', message: `${u.name} will be removed (soft delete) and signed out everywhere.`, confirmText: 'Delete', danger: true })) this.api.remove(u.id).subscribe({ next: () => { this.toast.success('User deleted.'); this.l.reload(); }, error: (e) => this.toast.error(toApiError(e).message) }); }
}
