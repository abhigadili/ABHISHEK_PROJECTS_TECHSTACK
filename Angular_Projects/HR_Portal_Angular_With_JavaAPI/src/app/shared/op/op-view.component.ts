import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, TemplateRef, computed, contentChild, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { OPERATION_MAP } from '../../api/client/api-client.service';
import { injectOp } from '../../api/queries/op-query';
import { PermissionService } from '../../core/services/permission.service';
import { CardComponent, ErrorStateComponent, LoadingBlockComponent } from '../components/ui.components';
import { DetailComponent } from '../components/value.components';
import { EmployeePickerComponent } from '../components/employee.components';
import { DataTableComponent, type Col } from '../tables/data-table.component';
import { humanize } from '../pipes/format.pipes';
import { monthStr } from '../utilities/date';

/** Required query parameters nobody supplied -> ask for them (simple template-driven form) instead of sending a request the backend answers with 400. */
@Component({
  selector: 'app-missing-params', standalone: true, imports: [FormsModule, EmployeePickerComponent, TranslateModule], changeDetection: ChangeDetectionStrategy.Default,
  template: `<form #f="ngForm" class="row g-2 align-items-end" (ngSubmit)="go()">
    @for (p of params(); track p.name) { <div class="col-12 col-md-4"><label class="field-label">{{ humanize(p.name) }} *</label>
      @if (isEmp(p.name)) { <app-employee-picker [name]="p.name" [(ngModel)]="vals[p.name]" /> }
      @else if (p.schema?.enum) { <select class="form-select" [name]="p.name" [(ngModel)]="vals[p.name]" required><option value="">—</option>@for (o of p.schema.enum; track o) { <option [value]="o">{{ o }}</option> }</select> }
      @else { <input class="form-control" [name]="p.name" [(ngModel)]="vals[p.name]" required [type]="typeOf(p.name)" /> } </div> }
    <div class="col-auto"><button class="btn-hr primary" type="submit" [disabled]="f.invalid">{{ 'common.run' | translate }}</button></div></form>`,
})
export class MissingParamsComponent {
  params = input.required<{ name: string; schema: any }[]>();
  done = input.required<(v: Record<string, string>) => void>();
  vals: Record<string, string> = {}; humanize = humanize;
  isEmp = (n: string) => /employeeId$/.test(n);
  typeOf = (n: string) => (/month|period/i.test(n) ? 'month' : /date$/i.test(n) ? 'date' : 'text');
  ngOnInit() { this.params().forEach((p) => (this.vals[p.name] = /month|period/i.test(p.name) ? monthStr() : /year/i.test(p.name) ? String(new Date().getFullYear()) : '')); }
  go() { if (this.params().every((p) => this.vals[p.name])) this.done()({ ...this.vals }); }
}

/** Shows the result of any GET operation: array -> table, object -> key/value card (+ nested arrays as tables), page -> table. */
@Component({
  selector: 'app-op-view', standalone: true, changeDetection: ChangeDetectionStrategy.Default,
  imports: [CardComponent, ErrorStateComponent, LoadingBlockComponent, DetailComponent, DataTableComponent, MissingParamsComponent, NgTemplateOutlet, TranslateModule],
  template: `
  @if (bare()) { <ng-container [ngTemplateOutlet]="bodyTpl" /> }
  @else { <app-card [title]="title() || op_().summary"><span actions class="d-flex gap-2 align-items-center"><ng-content select="[actions]" />
      <button type="button" class="btn-hr ghost icon" (click)="q.refetch()" [attr.aria-label]="'common.refresh' | translate"><i class="pi pi-refresh" [class.pi-spin]="q.isFetching()"></i></button></span>
    <ng-container [ngTemplateOutlet]="bodyTpl" /></app-card> }
  <ng-template #bodyTpl>
    @switch (mode()) {
      @case ('missing') { <app-missing-params [params]="unmet()" [done]="applyExtra" /> }
      @case ('forbidden') { <app-error-state [error]="notAuth" [retryable]="false" /> }
      @case ('loading') { <app-loading-block /> }
      @case ('error') { <app-error-state [error]="q.error()" (retry)="q.refetch()" /> }
      @case ('custom') { <ng-container [ngTemplateOutlet]="custom()!" [ngTemplateOutletContext]="{ $implicit: q.data() }" /> }
      @case ('rows') { <app-data-table [id]="tableId() || op()" [rows]="rows()!" [columns]="columns()" [emptyHint]="emptyHint()" [exportName]="op()" /> }
      @case ('obj') {
        <div class="d-flex flex-column gap-3">
          <app-detail [data]="obj()" [hide]="hide()" [cols]="cols()" />
          @for (s of sections(); track s[0]) { <div><div class="field-label">{{ humanize(s[0]) }}</div><app-detail [data]="s[1]" [cols]="cols()" /></div> }
          @for (t of tables(); track t[0]) { <div><div class="field-label">{{ humanize(t[0]) }}</div><app-data-table [id]="op() + '.' + t[0]" [rows]="t[1]" [exportName]="op() + '-' + t[0]" /></div> }
        </div> }
      @default { <div class="p-3" style="font-size:13px">{{ q.data() ?? '—' }}</div> }
    }
  </ng-template>`,
})
export class OpViewComponent {
  private perm = inject(PermissionService);
  op = input.required<string>(); path = input<Record<string, string | number>>(); query = input<Record<string, unknown>>(); title = input<string>();
  columns = input<Col[] | undefined>(); hide = input<string[]>([]); cols = input<1 | 2 | 3>(3); enabled = input(true); bare = input(false); emptyHint = input(''); refetchInterval = input<number | false>(false); tableId = input('');
  custom = contentChild<TemplateRef<any>>(TemplateRef);
  humanize = humanize; readonly notAuth = new Error('You are not authorised to view this.');
  op_ = computed(() => OPERATION_MAP[this.op()]);
  allowed = computed(() => this.perm.canCall(this.op()));
  extra = signal<Record<string, string>>({});
  applyExtra = (v: Record<string, string>) => this.extra.update((e) => ({ ...e, ...v }));
  unmet = computed(() => this.op_().query.filter((x) => x.required && this.query()?.[x.name] === undefined && !this.extra()[x.name]));
  q = injectOp<any>(() => this.op(), () => ({ path: this.path(), query: { ...(this.query() ?? {}), ...this.extra() } }), () => ({ enabled: this.enabled() && this.allowed() && this.unmet().length === 0, refetchInterval: this.refetchInterval() }));
  mode = computed(() => {
    if (this.unmet().length && this.allowed()) return 'missing'; if (!this.allowed()) return 'forbidden'; if (this.q.isLoading()) return 'loading'; if (this.q.isError()) return 'error';
    if (this.custom()) return 'custom'; if (this.rows()) return 'rows'; if (this.obj()) return 'obj'; return 'plain';
  });
  rows = computed(() => { const d = this.q.data(); return Array.isArray(d) ? d : Array.isArray(d?.content) ? d.content : null; });
  obj = computed(() => { const d = this.q.data(); return d && typeof d === 'object' ? d : null; });
  private entries = computed(() => Object.entries(this.obj() ?? {}).filter(([k]) => !this.hide().includes(k)));
  tables = computed(() => this.entries().flatMap(([k, v]): [string, any[]][] => (Array.isArray(v) && v.length && typeof v[0] === 'object' ? [[k, v]] : v && typeof v === 'object' && Array.isArray((v as any).content) && (v as any).content.length ? [[k, (v as any).content]] : [])));
  sections = computed(() => this.entries().filter(([, v]) => v && typeof v === 'object' && !Array.isArray(v) && !Array.isArray((v as any).content)) as [string, any][]);
}
