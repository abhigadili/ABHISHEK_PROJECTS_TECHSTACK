import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { injectOp } from '../../api/queries/op-query';
import { BadgeComponent, CardComponent, LoadingBlockComponent, PageHeaderComponent, TabDirective, TabsComponent } from '../../shared/components/ui.components';
import { EmployeeNameComponent } from '../../shared/components/employee.components';
import { ModalComponent } from '../../shared/components/modal.component';
import { DetailComponent } from '../../shared/components/value.components';
import { EmployeeScopeComponent } from '../../shared/op/employee-scope.component';
import { OpButtonComponent } from '../../shared/op/op-button.component';
import { OpViewComponent } from '../../shared/op/op-view.component';
import { CellDirective, type Col } from '../../shared/tables/data-table.component';
import { OpTableComponent } from '../../shared/tables/op-table.component';

@Component({
  selector: 'app-user-detail', standalone: true, changeDetection: ChangeDetectionStrategy.Default,
  imports: [ModalComponent, DetailComponent, BadgeComponent, OpButtonComponent, LoadingBlockComponent, EmployeeNameComponent],
  template: `<app-modal [open]="true" [title]="u()?.username ?? 'User'" size="lg" (closed)="closed.emit()">
    @if (q.isLoading()) { <app-loading-block /> }
    @if (u(); as u) { <div class="d-grid gap-3"><app-detail [data]="u" [hide]="['id', 'roles', 'permissions', 'employeeId']" /><div><div class="field-label">Employee</div>@if (u.employeeId) { <app-employee-name [id]="u.employeeId" /> } @else { — }</div>
      <div><div class="field-label">Roles</div><div class="d-flex gap-1 flex-wrap">@for (r of u.roles; track r) { <app-badge tone="primary">{{ r }}</app-badge> }</div></div>
      <div><div class="field-label">Permissions ({{ u.permissions?.length ?? 0 }})</div><div class="d-flex gap-1 flex-wrap">@for (r of u.permissions; track r) { <app-badge>{{ r }}</app-badge> }</div></div></div> }
    <ng-container footer>@if (u(); as u) { <div class="d-flex flex-wrap gap-2 justify-content-end">
      <app-op-button op="auth.roles" [path]="{ id: id() }" [initial]="{ roles: u.roles }" label="Roles" icon="pi-shield" size="md" /><app-op-button op="auth.map" [path]="{ id: id() }" [initial]="{ employeeId: u.employeeId }" label="Map employee" icon="pi-link" size="md" />
      <app-op-button op="auth.status" [path]="{ id: id() }" [initial]="{ status: u.status }" label="Status" icon="pi-power-off" size="md" /><app-op-button op="auth.unlock" [path]="{ id: id() }" label="Unlock" icon="pi-lock-open" size="md" confirm="Unlock this account?" />
      <app-op-button op="auth.revoke" [path]="{ id: id() }" label="Revoke sessions" icon="pi-sign-out" size="md" confirm="Sign this user out everywhere?" /><app-op-button op="auth.reset" [path]="{ id: id() }" label="Reset password" icon="pi-key" size="md" /></div> }</ng-container></app-modal>`,
})
export class UserDetailComponent { id = input.required<string>(); closed = output<void>(); q = injectOp<any>('auth.get', () => ({ path: { id: this.id() } })); u = computed(() => this.q.data()); }

@Component({
  selector: 'app-users-page', standalone: true, changeDetection: ChangeDetectionStrategy.Default,
  imports: [FormsModule, TranslateModule, PageHeaderComponent, CardComponent, BadgeComponent, TabsComponent, TabDirective, OpTableComponent, OpButtonComponent, OpViewComponent, EmployeeScopeComponent, EmployeeNameComponent, UserDetailComponent, CellDirective],
  template: `<app-page-header [title]="'hr.admin.users' | translate" [subtitle]="'hr.admin.usersSub' | translate"><app-op-button op="auth.register" label="Create user" icon="pi-user-plus" variant="primary" size="md" dialogSize="lg" [initial]="{ mustChangePassword: true }" /></app-page-header>
  <app-tabs>
    <ng-template appTab="users" [label]="'nav.users' | translate"><app-op-table op="auth.search" tableId="users" searchParam="q" [query]="{ status: status() }" [sortable]="['username', 'email', 'status']" [rowClickable]="true" (rowClick)="open.set($event.id)" [columns]="cols">
      <ng-template appCell="roles" let-r>@for (x of r.roles ?? []; track x) { <app-badge tone="primary">{{ x }}</app-badge> <span> </span> }</ng-template>
      <ng-template appCell="employeeId" let-r><app-employee-name [id]="r.employeeId" /></ng-template>
      <select filters class="form-select" style="width:auto" [ngModel]="status()" (ngModelChange)="status.set($event)" [attr.aria-label]="'common.status' | translate"><option value="">{{ 'common.all' | translate }}</option>@for (s of sts; track s) { <option>{{ s }}</option> }</select></app-op-table></ng-template>
    <ng-template appTab="lookup" label="Find by employee"><app-card title="Employee → user account"><app-employee-scope><ng-template let-id><app-op-view op="auth.byEmployee" [path]="{ employeeId: id }" title="Linked account" /></ng-template></app-employee-scope></app-card></ng-template>
  </app-tabs>
  @if (open(); as o) { <app-user-detail [id]="o" (closed)="open.set(null)" /> }`,
})
export class UsersPage {
  open = signal<string | null>(null); status = signal(''); sts = ['ACTIVE', 'INACTIVE', 'LOCKED'];
  cols: Col[] = [{ key: 'username', sortable: true }, { key: 'email', sortable: true }, { key: 'roles' }, { key: 'employeeId' }, { key: 'status', sortable: true }, { key: 'lastLoginAt' }, { key: 'mustChangePassword', hidden: true }];
}
export default UsersPage;
