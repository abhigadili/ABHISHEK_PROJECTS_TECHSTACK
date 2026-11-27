import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { injectOp } from '../../api/queries/op-query';
import { PermissionService } from '../../core/services/permission.service';
import { ChartCardComponent } from '../../shared/charts/chart-card.component';
import { barOption } from '../../shared/charts/chart-options';
import { RefService } from '../../shared/components/ref.service';
import { CardComponent, EmptyStateComponent, PageHeaderComponent } from '../../shared/components/ui.components';
import { OpViewComponent } from '../../shared/op/op-view.component';
import { financialYear, monthStr } from '../../shared/utilities/date';

type P = { name: string; kind: 'month' | 'year' | 'fy' | 'cycle' | 'select' | 'text'; options?: string[]; def?: string };
interface R { key: string; op: string; label: string; params: P[] }
const REPORTS: R[] = [
  { key: 'exec', op: 'reporting.executive', label: 'Executive summary', params: [] },
  { key: 'headcount', op: 'reporting.headcount', label: 'Employee headcount', params: [{ name: 'groupBy', kind: 'select', options: ['department', 'designation', 'location', 'status', 'employmentType'], def: 'department' }] },
  { key: 'departments', op: 'reporting.departments', label: 'Departments', params: [] },
  { key: 'joining', op: 'reporting.joiningExit', label: 'Joining & exits', params: [{ name: 'year', kind: 'year' }] },
  { key: 'attendance', op: 'reporting.attendance', label: 'Attendance', params: [{ name: 'month', kind: 'month' }] },
  { key: 'leave', op: 'reporting.leave', label: 'Leave', params: [{ name: 'period', kind: 'month' }] },
  { key: 'payroll', op: 'reporting.payroll', label: 'Payroll', params: [{ name: 'month', kind: 'month' }] },
  { key: 'timesheets', op: 'reporting.timesheets', label: 'Timesheets', params: [{ name: 'month', kind: 'month' }] },
  { key: 'performance', op: 'reporting.performance', label: 'Performance', params: [{ name: 'cycleId', kind: 'cycle' }] },
  { key: 'allocation', op: 'reporting.allocation', label: 'Project allocation', params: [] },
  { key: 'tax', op: 'reporting.tax', label: 'Income tax', params: [{ name: 'financialYear', kind: 'fy' }] },
  { key: 'exits', op: 'reporting.exits', label: 'Exits', params: [] },
  { key: 'workforce', op: 'reporting.workforce', label: 'Workforce analytics', params: [] },
];

/** Draws a bar chart from the first array of rows in a report that has a label + numeric columns. */
@Component({
  selector: 'app-auto-chart', standalone: true, imports: [ChartCardComponent], changeDetection: ChangeDetectionStrategy.Default,
  template: `@if (spec(); as s) { <div class="mb-3"><app-chart-card title="Chart" [height]="240" [build]="build" [loading]="q.isLoading()" /></div> }`,
})
export class AutoChartComponent {
  op = input.required<string>(); query = input.required<Record<string, unknown>>();
  q = injectOp<any>(() => this.op(), () => ({ query: this.query() }));
  spec = computed(() => {
    const find = (o: any): any[] | null => { if (Array.isArray(o) && o.length && typeof o[0] === 'object') return o; if (o && typeof o === 'object') for (const v of Object.values(o)) { const r = find(v); if (r) return r; } return null; };
    const rows = find(this.q.data()); if (!rows) return null;
    const label = Object.keys(rows[0]).find((k) => typeof rows[0][k] === 'string' && !/id$/i.test(k)) ?? Object.keys(rows[0])[0];
    const nums = Object.keys(rows[0]).filter((k) => typeof rows[0][k] === 'number' || (typeof rows[0][k] === 'string' && /^-?\d+(\.\d+)?$/.test(rows[0][k]) && k !== label)).slice(0, 3);
    if (!nums.length) return null;
    return { rows: rows.map((r) => ({ ...r, ...Object.fromEntries(nums.map((n) => [n, Number(r[n])])) })), label, nums };
  });
  build = (dark: boolean) => { const s = this.spec()!; return barOption(dark, s.rows, s.label, s.nums.map((n) => ({ key: n, label: n }))); };
}

@Component({
  selector: 'app-reports-page', standalone: true, changeDetection: ChangeDetectionStrategy.Default,
  imports: [FormsModule, TranslateModule, PageHeaderComponent, CardComponent, EmptyStateComponent, OpViewComponent, AutoChartComponent],
  template: `<app-page-header [title]="'hr.reports.title' | translate" [subtitle]="'hr.reports.sub' | translate" />
  @if (!cur()) { <app-card><app-empty-state [title]="'common.notAuthorized' | translate" /></app-card> } @else {
    <div class="row g-3"><div class="col-12 col-lg-3"><div class="hr-card p-2">@for (r of avail(); track r.key) { <button type="button" (click)="sel.set(r.key)" class="mb-1 d-block w-100 rounded-2 border-0 px-3 py-2 text-start" style="font-size:13px" [style.background]="cur()!.key === r.key ? 'var(--hr-primary-soft)' : 'transparent'" [style.color]="cur()!.key === r.key ? 'var(--hr-primary)' : 'var(--hr-text)'">{{ r.label }}</button> }</div></div>
      <div class="col-12 col-lg-9">
        <!-- template-driven report filters -->
        <form class="mb-3 d-flex flex-wrap gap-2" #f="ngForm">@for (p of cur()!.params; track p.name) {
          @switch (p.kind) {
            @case ('select') { <select class="form-select" style="width:auto" [name]="p.name" [ngModel]="vals()[p.name] || p.def" (ngModelChange)="set(p.name, $event)" [attr.aria-label]="p.name">@for (o of p.options; track o) { <option>{{ o }}</option> }</select> }
            @case ('month') { <input type="month" class="form-control" style="width:auto" [name]="p.name" [ngModel]="vals()[p.name]" (ngModelChange)="$event && set(p.name, $event)" [attr.aria-label]="p.name" /> }
            @case ('cycle') { <select class="form-select" style="width:auto" name="cycle" [ngModel]="cycleId()" (ngModelChange)="set('cycleId', $event)" aria-label="cycle">@for (o of cycles(); track o.value) { <option [value]="o.value">{{ o.label }}</option> }</select> }
            @default { <input class="form-control" style="width:130px" [name]="p.name" [ngModel]="vals()[p.name]" (ngModelChange)="set(p.name, $event)" [attr.aria-label]="p.name" /> } } }</form>
        @for (k of [key()]; track k) { <app-auto-chart [op]="cur()!.op" [query]="query()" /><app-op-view [op]="cur()!.op" [query]="query()" [title]="cur()!.label" [enabled]="ready()" /> }
      </div></div> }`,
})
export class ReportsPage {
  private perm = inject(PermissionService); cycles = inject(RefService).options('cycle');
  avail = computed(() => { this.perm.user(); return REPORTS.filter((r) => this.perm.canCall(r.op)); });
  sel = signal(''); cur = computed(() => this.avail().find((r) => r.key === this.sel()) ?? this.avail()[0]);
  vals = signal<Record<string, string>>({ month: monthStr(), period: monthStr(), year: String(new Date().getFullYear()), financialYear: financialYear(), groupBy: 'department' });
  cycleId = computed(() => this.vals()['cycleId'] || this.cycles()[0]?.value || '');
  query = computed(() => { const c = this.cur(); return c ? Object.fromEntries(c.params.map((p) => [p.name, p.name === 'cycleId' ? this.cycleId() : this.vals()[p.name]])) : {}; });
  key = computed(() => this.cur()?.key + JSON.stringify(this.query())); ready = computed(() => (this.cur()?.params ?? []).every((p) => this.query()[p.name]));
  set(k: string, v: string) { this.vals.set({ ...this.vals(), [k]: v }); }
}
export default ReportsPage;
