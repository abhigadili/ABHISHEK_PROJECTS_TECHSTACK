import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { animate, style, transition, trigger } from '@angular/animations';
import { TranslateModule } from '@ngx-translate/core';
import { TreeModule } from 'primeng/tree';
import type { TreeNode } from 'primeng/api';
import { injectOp } from '../../api/queries/op-query';
import { EmptyStateComponent, ErrorStateComponent, LoadingBlockComponent, PageHeaderComponent, TabDirective, TabsComponent } from '../../shared/components/ui.components';
import { RefService } from '../../shared/components/ref.service';
import { StatusBadgeComponent } from '../../shared/components/value.components';
import { OpViewComponent } from '../../shared/op/op-view.component';
import { OpTableComponent } from '../../shared/tables/op-table.component';
import { initials } from '../../shared/utilities/date';

type ChartNode = { employeeId?: string; fullName?: string; employeeCode?: string; designation?: string; department?: string; status?: string; directReports?: number; reports?: ChartNode[] };
export const matches = (n: ChartNode, q: string, dept: string): boolean =>
  ((!q || `${n.fullName} ${n.employeeCode} ${n.designation}`.toLowerCase().includes(q)) && (!dept || n.department === dept)) || (n.reports ?? []).some((r) => matches(r, q, dept));

/** One node of the hierarchy: expand / collapse (animated), highlight on search, open the profile, focus the subtree. */
@Component({
  selector: 'app-org-node', standalone: true, changeDetection: ChangeDetectionStrategy.Default, imports: [StatusBadgeComponent],
  animations: [trigger('kids', [transition(':enter', [style({ height: 0, opacity: 0, overflow: 'hidden' }), animate('150ms ease-out', style({ height: '*', opacity: 1 }))]), transition(':leave', [style({ overflow: 'hidden' }), animate('120ms ease-in', style({ height: 0, opacity: 0 }))])])],
  template: `<li>
    <div class="d-inline-flex align-items-center gap-2 rounded-3 px-2 py-1" [style.border]="hit() ? '1px solid var(--hr-primary)' : '1px solid var(--hr-border)'" [style.background]="hit() ? 'var(--hr-primary-soft)' : 'var(--hr-surface)'">
      @if (kids().length) { <button type="button" class="border-0 bg-transparent p-0" (click)="open.set(!open())" [attr.aria-expanded]="isOpen()" [attr.aria-label]="isOpen() ? 'collapse' : 'expand'"><i class="pi" [class.pi-chevron-down]="isOpen()" [class.pi-chevron-right]="!isOpen()" style="font-size:12px"></i></button> } @else { <span style="width:12px"></span> }
      <span class="d-inline-flex align-items-center justify-content-center rounded-circle" style="width:28px;height:28px;font-size:11px;background:var(--hr-primary-soft);color:var(--hr-primary)">{{ ini() }}</span>
      <button type="button" class="border-0 bg-transparent p-0 text-start" (click)="openProfile.emit(n().employeeId!)"><div class="fw-semibold" style="font-size:13px">{{ n().fullName }} <span class="text-muted fw-normal">· {{ n().employeeCode }}</span></div><div class="text-muted" style="font-size:11px">{{ n().designation }} · {{ n().department }}</div></button>
      <app-status-badge [value]="n().status" />
      @if ((n().directReports ?? 0) > 0) { <button type="button" class="rounded-pill border-0 px-2 text-muted" style="font-size:11px;background:var(--hr-surface-2)" title="Show only this subtree" (click)="focus.emit(n().employeeId!)">{{ n().directReports }}</button> }
    </div>
    @if (isOpen() && kids().length) { <ul class="org-tree" @kids>@for (k of kids(); track k.employeeId) { <app-org-node [n]="k" [depth]="depth() + 1" [q]="q()" [dept]="dept()" (openProfile)="openProfile.emit($event)" (focus)="focus.emit($event)" /> }</ul> }
  </li>`,
})
export class OrgNodeComponent {
  n = input.required<ChartNode>(); depth = input(0); q = input(''); dept = input(''); openProfile = output<string>(); focus = output<string>();
  open = signal<boolean | null>(null);
  kids = computed(() => (this.n().reports ?? []).filter((r) => matches(r, this.q(), this.dept())));
  isOpen = computed(() => !!(this.q() || this.dept()) || (this.open() ?? this.depth() < 1));
  hit = computed(() => !!this.q() && `${this.n().fullName} ${this.n().employeeCode}`.toLowerCase().includes(this.q()));
  ini = computed(() => initials(this.n().fullName));
}

@Component({
  selector: 'app-dept-members', standalone: true, imports: [FormsModule, OpTableComponent], changeDetection: ChangeDetectionStrategy.Default,
  template: `<select class="form-select mb-3" style="width:auto" [ngModel]="id()" (ngModelChange)="d.set($event)" aria-label="department">@for (o of opts(); track o.value) { <option [value]="o.value">{{ o.label }}</option> }</select>
    @if (id()) { <app-op-table op="organization.departmentEmployees" [path]="{ id: id() }" tableId="dept-members" /> }`,
})
export class DeptMembersComponent { private refs = inject(RefService); opts = this.refs.options('department'); d = signal(''); id = computed(() => this.d() || this.opts()[0]?.value || ''); }

@Component({
  selector: 'app-org-chart-page', standalone: true, changeDetection: ChangeDetectionStrategy.Default,
  imports: [FormsModule, TranslateModule, TreeModule, PageHeaderComponent, TabsComponent, TabDirective, OrgNodeComponent, DeptMembersComponent, OpViewComponent, LoadingBlockComponent, ErrorStateComponent, EmptyStateComponent],
  template: `<app-page-header [title]="'hr.org.title' | translate" [subtitle]="'hr.org.sub' | translate" />
  <app-tabs>
    <ng-template appTab="chart" [label]="'hr.org.title' | translate">
      <div class="mb-3 d-flex flex-wrap gap-2 align-items-center">
        <div class="position-relative" style="min-width:220px"><i class="pi pi-search position-absolute text-muted" style="left:10px;top:11px;font-size:12px"></i><input class="form-control" style="padding-left:30px" [ngModel]="q()" (ngModelChange)="q.set($event)" [placeholder]="'common.search' | translate" [attr.aria-label]="'common.search' | translate" /></div>
        <select class="form-select" style="width:auto" [ngModel]="dept()" (ngModelChange)="dept.set($event)" [attr.aria-label]="'common.department' | translate"><option value="">{{ 'common.all' | translate }} · {{ 'common.department' | translate }}</option>@for (d of deps(); track d.value) { <option [value]="d.value">{{ d.label }}</option> }</select>
        <button type="button" class="btn-hr outline" (click)="ver.set(ver() + 1)">{{ 'hr.org.collapseAll' | translate }}</button>
        @if (focusId()) { <button type="button" class="btn-hr soft" (click)="focusId.set('')">← {{ 'common.all' | translate }}</button> }</div>
      <div class="hr-card p-3 overflow-auto">
        @if (active().isLoading()) { <app-loading-block /> } @else if (active().isError()) { <app-error-state [error]="active().error()" /> } @else if (!shown().length) { <app-empty-state /> }
        @else { <ul class="org-tree" style="border-left:0;padding-left:0">@for (r of shown(); track r.employeeId + '-' + ver()) { <app-org-node [n]="r" [q]="ql()" [dept]="deptName()" (openProfile)="go($event)" (focus)="focusId.set($event)" /> }</ul> }</div>
    </ng-template>
    <ng-template appTab="departments" [label]="'hr.org.departmentTree' | translate"><div class="row g-3">
      <div class="col-12 col-lg-5"><div class="hr-card p-3">@if (tree.isLoading()) { <app-loading-block /> } @else { <p-tree [value]="deptNodes()" selectionMode="single" /> }</div></div>
      <div class="col-12 col-lg-7"><app-op-view op="organization.headcount" title="Headcount ranking" /></div></div></ng-template>
    <ng-template appTab="members" [label]="'nav.employees' | translate"><app-dept-members /></ng-template>
  </app-tabs>`,
})
export class OrgChartPage {
  private router = inject(Router); private refs = inject(RefService);
  q = signal(''); dept = signal(''); focusId = signal(''); ver = signal(0);
  deps = this.refs.options('department');
  chart = injectOp<ChartNode[]>('organization.chart', undefined, () => ({ enabled: !this.focusId() }));
  sub = injectOp<ChartNode>('organization.chartFor', () => ({ path: { employeeId: this.focusId() } }), () => ({ enabled: !!this.focusId() }));
  tree = injectOp<any[]>('organization.departmentTree');
  active = computed<any>(() => (this.focusId() ? this.sub : this.chart));
  ql = computed(() => this.q().trim().toLowerCase());
  deptName = computed(() => this.deps().find((d) => d.value === this.dept())?.label ?? '');
  roots = computed<ChartNode[]>(() => (this.focusId() ? (this.sub.data() ? [this.sub.data()!] : []) : this.chart.data() ?? []));
  shown = computed(() => this.roots().filter((r) => matches(r, this.ql(), this.deptName())));
  deptNodes = computed<TreeNode[]>(() => { const f = (n: any): TreeNode => ({ label: `${n.name} (${n.code}) · ${n.employeeCount ?? 0} employees`, expanded: true, children: (n.children ?? []).map(f) }); return (this.tree.data() ?? []).map(f); });
  go(id: string) { this.router.navigate(['/employees', id]); }
}
export default OrgChartPage;
