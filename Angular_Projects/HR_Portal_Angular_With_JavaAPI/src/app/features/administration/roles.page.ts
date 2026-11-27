import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { injectOp } from '../../api/queries/op-query';
import { BadgeComponent, CardComponent, PageHeaderComponent, TabDirective, TabsComponent } from '../../shared/components/ui.components';
import { CrudSectionComponent } from '../../shared/op/crud-section.component';
import { OpButtonComponent } from '../../shared/op/op-button.component';
import { type Col } from '../../shared/tables/data-table.component';

/** Role × permission matrix (read-only overview) built from the two list endpoints. */
@Component({
  selector: 'app-permission-matrix', standalone: true, imports: [FormsModule, CardComponent, BadgeComponent], changeDetection: ChangeDetectionStrategy.Default,
  template: `<app-card title="Permission matrix" [flush]="true"><input actions class="form-control" style="width:auto" placeholder="Filter permissions" [ngModel]="filter()" (ngModelChange)="filter.set($event)" aria-label="filter" />
    <div style="overflow:auto;max-height:68vh"><table class="table m-0" style="font-size:13px"><thead><tr><th>Permission</th>@for (r of roles(); track r.id) { <th class="text-center">{{ r.name }}</th> }</tr></thead>
      <tbody>@for (p of perms(); track p.id) { <tr><td><code>{{ p.code }}</code><div class="text-muted" style="font-size:11px">{{ p.description }}</div></td>@for (r of roles(); track r.id) { <td class="text-center">@if (has(r, p.code)) { <app-badge tone="success">✓</app-badge> } @else { <span class="text-muted">·</span> }</td> }</tr> }</tbody></table></div></app-card>`,
})
export class PermissionMatrixComponent {
  rq = injectOp<any[]>('auth.rolesRolesAndPermissions'); pq = injectOp<any[]>('auth.permissions'); filter = signal('');
  roles = computed(() => this.rq.data() ?? []); perms = computed(() => (this.pq.data() ?? []).filter((p) => p.code.toLowerCase().includes(this.filter().toLowerCase())));
  has = (r: any, code: string) => (r.permissions ?? []).includes(code) || (r.permissions ?? []).includes('PERM_' + code);
}

@Component({
  selector: 'app-roles-page', standalone: true, changeDetection: ChangeDetectionStrategy.Default,
  imports: [TranslateModule, PageHeaderComponent, TabsComponent, TabDirective, CrudSectionComponent, OpButtonComponent, PermissionMatrixComponent],
  template: `<app-page-header [title]="'hr.admin.roles' | translate" [subtitle]="'hr.admin.rolesSub' | translate" />
  <app-tabs>
    <ng-template appTab="roles" [label]="'nav.roles' | translate"><app-crud-section title="Roles" [list]="{ op: 'auth.rolesRolesAndPermissions' }" [create]="{ op: 'auth.createRole' }" dialogSize="lg" tableId="roles" [columns]="cols" [extraRowActions]="perm" /></ng-template>
    <ng-template appTab="perms" [label]="'common.permissions' | translate"><app-crud-section title="Permissions" [list]="{ op: 'auth.permissions' }" [create]="{ op: 'auth.createPermission' }" tableId="perms" /></ng-template>
    <ng-template appTab="matrix" label="Matrix"><app-permission-matrix /></ng-template>
  </app-tabs>
  <ng-template #perm let-r><app-op-button op="auth.setPermissions" [path]="{ id: r.id }" [initial]="{ permissions: r.permissions }" label="Permissions" variant="ghost" dialogSize="lg" /></ng-template>`,
})
export class RolesPage { cols: Col[] = [{ key: 'name' }, { key: 'description' }, { key: 'permissions', fmt: (v) => `${v?.length ?? 0} permission(s)` }]; }
export default RolesPage;
