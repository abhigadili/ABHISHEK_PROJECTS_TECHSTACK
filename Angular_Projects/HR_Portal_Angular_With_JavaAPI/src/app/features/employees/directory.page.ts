import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { PageHeaderComponent, TabDirective, TabsComponent } from '../../shared/components/ui.components';
import { RefService } from '../../shared/components/ref.service';
import { StatusBadgeComponent } from '../../shared/components/value.components';
import { OpTableComponent } from '../../shared/tables/op-table.component';
import { OpViewComponent } from '../../shared/op/op-view.component';
import type { Col } from '../../shared/tables/data-table.component';

@Component({
  selector: 'app-grouped-directory', standalone: true, changeDetection: ChangeDetectionStrategy.Default, imports: [OpViewComponent, StatusBadgeComponent],
  template: `<app-op-view op="employee.grouped" title="A–Z" [bare]="true"><ng-template let-d>
    @if (d?.statusCounts) { <div class="mb-3 d-flex gap-2 flex-wrap">@for (e of entries(d.statusCounts); track e[0]) { <span class="rounded-2 px-2 py-1" style="font-size:12px;background:var(--hr-primary-soft)"><app-status-badge [value]="e[0]" /> {{ e[1] }}</span> }</div> }
    @for (k of keys(d); track k) { <div class="mb-3"><div class="field-label">{{ k }}</div><div class="row g-2">@for (e of groups(d)[k]; track e.id) {
      <div class="col-12 col-md-6 col-xl-4"><div class="hr-card d-flex align-items-center gap-2 p-2"><span class="d-inline-flex align-items-center justify-content-center rounded-circle" style="width:34px;height:34px;font-size:13px;background:var(--hr-primary-soft);color:var(--hr-primary)">{{ initials(e.fullName) }}</span>
        <button type="button" class="border-0 bg-transparent p-0 text-start" (click)="go(e.id)"><div class="fw-semibold" style="font-size:13px">{{ e.fullName }}</div><div class="text-muted" style="font-size:11px">{{ e.employeeCode }} · {{ refs.label('department', e.departmentId) }}</div></button></div></div> }</div></div> }
  </ng-template></app-op-view>`,
})
export class GroupedDirectoryComponent {
  refs = inject(RefService); private router = inject(Router);
  entries = (o: any) => Object.entries(o) as [string, any][];
  groups = (d: any): Record<string, any[]> => d?.byInitial ?? d?.groups ?? (d && typeof d === 'object' ? Object.fromEntries(Object.entries(d).filter(([, v]) => Array.isArray(v))) : {});
  keys = (d: any) => Object.keys(this.groups(d)).sort();
  initials = (n?: string) => (n ?? '?').split(' ').map((x) => x[0]).slice(0, 2).join('').toUpperCase();
  go(id: string) { this.router.navigate(['/employees', id]); }
}

@Component({
  selector: 'app-directory-page', standalone: true, changeDetection: ChangeDetectionStrategy.Default,
  imports: [TranslateModule, PageHeaderComponent, TabsComponent, TabDirective, OpTableComponent, OpViewComponent, GroupedDirectoryComponent],
  template: `<app-page-header [title]="'nav.directory' | translate" [subtitle]="'hr.employees.sub' | translate" />
  <app-tabs>
    <ng-template appTab="list" [label]="'nav.directory' | translate"><app-op-table op="employee.directory" tableId="directory" searchParam="q" [sortable]="['fullName', 'employeeCode']" [columns]="cols" [rowClickable]="true" (rowClick)="open($event)" /></ng-template>
    <ng-template appTab="grouped" label="A–Z"><app-grouped-directory /></ng-template>
    <ng-template appTab="span" label="Span of control"><app-op-view op="employee.span" [query]="{ limit: 10 }" /></ng-template>
    <ng-template appTab="headcount" [label]="'hr.dashboard.totalEmployees' | translate"><app-op-view op="employee.headcount" /></ng-template>
  </app-tabs>`,
})
export class DirectoryPage {
  private router = inject(Router);
  cols: Col[] = [{ key: 'employeeCode', sortable: true }, { key: 'fullName', sortable: true }, { key: 'workEmail' }, { key: 'departmentId' }, { key: 'designationId' }, { key: 'locationId' }, { key: 'status' }];
  open(r: any) { this.router.navigate(['/employees', r.id]); }
  c = computed(() => 0);
}
export default DirectoryPage;
