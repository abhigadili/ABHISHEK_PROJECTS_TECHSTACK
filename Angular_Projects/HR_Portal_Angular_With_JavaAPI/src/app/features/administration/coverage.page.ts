import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { COVERAGE } from '../../coverage/coverage.registry';
import { BadgeComponent, CardComponent, EmptyStateComponent, KpiCardComponent, PageHeaderComponent } from '../../shared/components/ui.components';
import { CellDirective, DataTableComponent, type Col } from '../../shared/tables/data-table.component';
import { ProgressBarComponent } from '../projects/progress';

/** Endpoint coverage registry (generated from the backend inventory + the frontend source by scripts/verify-coverage.mjs). */
@Component({
  selector: 'app-coverage-page', standalone: true, changeDetection: ChangeDetectionStrategy.Default,
  imports: [FormsModule, TranslateModule, PageHeaderComponent, CardComponent, EmptyStateComponent, KpiCardComponent, DataTableComponent, BadgeComponent, ProgressBarComponent, CellDirective],
  template: `<app-page-header [title]="'hr.admin.coverage' | translate" [subtitle]="'hr.admin.coverageSub' | translate" />
  @if (!total) { <app-card><app-empty-state title="Coverage not generated" hint="Run: npm run verify:coverage" /></app-card> } @else {
    <div class="row g-3 mb-3"><div class="col-6 col-lg-3"><app-kpi-card label="Discovered endpoints" [value]="total" icon="pi-list" /></div><div class="col-6 col-lg-3"><app-kpi-card label="Integrated in UI" [value]="integ" icon="pi-check-circle" color="var(--hr-success)" /></div>
      <div class="col-6 col-lg-3"><app-kpi-card label="Not integrated" [value]="total - integ" icon="pi-times-circle" [color]="total - integ ? 'var(--hr-danger)' : 'var(--hr-success)'" /></div>
      <div class="col-6 col-lg-3"><app-kpi-card label="Integration" [value]="pct + '%'" [hint]="restricted + ' restricted endpoints'" icon="pi-percentage" /></div></div>
    <div class="mb-3"><app-data-table id="cov-svc" [rows]="bySvc" exportName="coverage-by-service" [columns]="svcCols"><ng-template appCell="percent" let-r><app-progress-bar [value]="r.percent" /></ng-template></app-data-table></div>
    <app-data-table id="cov" [rows]="rows()" exportName="endpoint-coverage" [searchable]="true" (searchChange)="q.set($event)" [columns]="cols">
      <ng-template appCell="path" let-r><code style="font-size:12px">{{ r.path }}</code></ng-template>
      <ng-template appCell="authorize" let-r>@if (r.authorize) { <app-badge tone="warning">restricted</app-badge> } @else { — }</ng-template>
      <ng-template appCell="status" let-r><app-badge [tone]="r.status === 'not-integrated' ? 'danger' : 'success'">{{ r.status }}</app-badge></ng-template>
      <span toolbar class="contents"><select class="form-select" style="width:auto" [ngModel]="st()" (ngModelChange)="st.set($event)" aria-label="status"><option value="">All</option><option value="integrated">integrated</option><option value="infrastructure">infrastructure</option><option value="not-integrated">not integrated</option></select></span></app-data-table> }`,
})
export class CoveragePage {
  total = COVERAGE.length; integ = COVERAGE.filter((c) => c.status !== 'not-integrated').length; restricted = COVERAGE.filter((c) => c.authorize).length; pct = this.total ? Math.round((this.integ / this.total) * 100) : 0;
  q = signal(''); st = signal('');
  bySvc = (() => { const m = new Map<string, { n: number; ok: number }>(); COVERAGE.forEach((c) => { const x = m.get(c.service) ?? { n: 0, ok: 0 }; x.n++; if (c.status !== 'not-integrated') x.ok++; m.set(c.service, x); }); return [...m].map(([service, v]) => ({ service, endpoints: v.n, integrated: v.ok, percent: Math.round((v.ok / v.n) * 100) })); })();
  svcCols: Col[] = [{ key: 'service' }, { key: 'endpoints' }, { key: 'integrated' }, { key: 'percent' }];
  cols: Col[] = [{ key: 'id', label: 'Endpoint id' }, { key: 'method' }, { key: 'path' }, { key: 'controller', label: 'Backend controller' }, { key: 'service', label: 'Backend module' }, { key: 'module', label: 'Frontend module' }, { key: 'files', label: 'Page / component', fmt: (v: string[]) => (v ?? []).map((f) => f.split('/').pop()).join(', ') },
    { key: 'serviceMethod', label: 'Angular service method' }, { key: 'integration', label: 'Query / mutation' }, { key: 'authenticated', label: 'Auth required', fmt: (v) => (v ? 'yes' : 'no') }, { key: 'authorize', label: 'Authorization' }, { key: 'status' }, { key: 'reason', hidden: true }];
  rows = computed(() => { const q = this.q().toLowerCase(); return COVERAGE.filter((c) => (!this.st() || c.status === this.st()) && (!q || `${c.id} ${c.path} ${c.module} ${c.controller}`.toLowerCase().includes(q))); });
}
export default CoveragePage;
