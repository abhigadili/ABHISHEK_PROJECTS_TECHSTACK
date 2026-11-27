import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { ApiClient } from '../../api/client/api-client.service';
import { OPERATIONS } from '../../api/generated/operations';
import type { OperationDef, SchemaDef } from '../../api/models/operation.model';
import { COVERAGE_MAP } from '../../coverage/coverage.registry';
import { MODULE_ROUTE } from '../../coverage/coverage.model';
import { PermissionService } from '../../core/services/permission.service';
import { ModalComponent } from '../../shared/components/modal.component';
import { BadgeComponent, CardComponent, PageHeaderComponent } from '../../shared/components/ui.components';
import { OpFormComponent } from '../../shared/op/op-form.component';
import { CellDirective, DataTableComponent, type Col } from '../../shared/tables/data-table.component';
import { SERVICES } from './audit.page';

type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'primary';
const METHOD_TONE: Record<string, Tone> = { GET: 'info', POST: 'success', PUT: 'warning', PATCH: 'warning', DELETE: 'danger' };
/** Session-critical operations are never executable from the explorer (it would end the admin's own session). */
const BLOCKED = new Set(['auth.login', 'auth.logout', 'auth.refresh', 'auth.changePassword']);
const mask = (v: any): any => (Array.isArray(v) ? v.map(mask) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, /token|password|secret/i.test(k) && typeof x === 'string' ? '••••••' : mask(x)])) : v);
const props = (s: SchemaDef | null) => !s?.properties ? [] : Object.entries(s.properties).map(([name, p]) => ({
  name, req: !!s.required?.includes(name), type: p.enum ? p.enum.join(' | ') : p.type === 'array' ? `${p.items?.type ?? 'object'}[]` : `${p.type ?? 'object'}${p.format ? `(${p.format})` : ''}`,
  rules: [p.minLength != null && `min ${p.minLength}`, p.maxLength != null && `max ${p.maxLength}`, p.minimum != null && `≥ ${p.minimum}`, p.maximum != null && `≤ ${p.maximum}`, p.pattern && `/${p.pattern}/`].filter(Boolean).join(', '),
}));

@Component({
  selector: 'app-service-health', standalone: true, imports: [CardComponent, BadgeComponent], changeDetection: ChangeDetectionStrategy.Default,
  template: `<app-card title="Service health (/ping)" class="d-block mb-3"><button actions type="button" class="btn-hr outline sm" (click)="check()"><i class="pi pi-heart"></i>Check all</button>
    <div class="d-flex flex-wrap gap-2">@for (s of services; track s) { <app-badge [tone]="res()[s] ? (res()[s].startsWith('up') ? 'success' : 'danger') : 'neutral'">{{ s }}{{ res()[s] ? ' · ' + res()[s] : '' }}</app-badge> }</div></app-card>`,
})
export class ServiceHealthComponent {
  private api = inject(ApiClient); services = SERVICES; res = signal<Record<string, string>>({});
  async check() {
    const out: Record<string, string> = {};
    await Promise.all(SERVICES.map(async (s) => { const t0 = performance.now(); try { await firstValueFrom(this.api.call(`${s}.ping`)); out[s] = `up · ${Math.round(performance.now() - t0)} ms`; } catch (e: any) { out[s] = `down · ${e.message}`; } }));
    this.res.set(out);
  }
}

@Component({
  selector: 'app-endpoint-details', standalone: true, changeDetection: ChangeDetectionStrategy.Default,
  imports: [FormsModule, TranslateModule, RouterLink, ModalComponent, BadgeComponent, DataTableComponent, OpFormComponent],
  template: `<app-modal [open]="true" [title]="op().summary" [description]="op().method + ' ' + op().path" size="xl" (closed)="closed.emit()">
    <div class="d-grid gap-3" style="font-size:13px">
      <div class="row g-3"><div class="col-md-4"><div class="field-label">Operation id</div><code>{{ op().id }}</code></div>
        <div class="col-md-4"><div class="field-label">Authentication</div>{{ op().public ? 'Public' : 'Bearer JWT' }}</div>
        <div class="col-md-4"><div class="field-label">Authorization (&#64;PreAuthorize)</div><code>{{ op().authorize ?? 'any authenticated user' }}</code></div>
        <div class="col-md-4"><div class="field-label">Backend controller</div><code>{{ cov()?.controller ?? '—' }}</code></div>
        <div class="col-md-4"><div class="field-label">Angular service method</div><code>{{ cov()?.serviceMethod ?? '—' }}</code> <span class="text-muted">({{ cov()?.integration }})</span></div>
        <div class="col-md-4"><div class="field-label">Integration</div><app-badge [tone]="cov()?.status === 'not-integrated' ? 'danger' : 'success'">{{ cov()?.status ?? 'unknown' }}</app-badge></div>
        <div class="col-md-8"><div class="field-label">Related UI</div>@for (f of cov()?.files ?? []; track f) { <div><a [routerLink]="route()" (click)="closed.emit()">{{ f.replace('src/app/', '') }}</a></div> } @empty { — }</div>
        <div class="col-md-4"><div class="field-label">Response</div><code>{{ op().binary ? 'binary file' : op().responseType ?? 'no body' }}</code> @if (op().responseStatus) { <span class="text-muted">({{ op().responseStatus }})</span> }</div></div>
      @if (params().length) { <div><div class="field-label">Parameters</div><app-data-table id="ex-params" [rows]="params()" /></div> }
      @if (body().length) { <div><div class="field-label">Request body @if (op().multipart) { (multipart) }</div><app-data-table id="ex-body" [rows]="body()" /></div> }
      @if (canRun()) { <div><div class="field-label">Execute (administrative / diagnostic)</div>
        @if (op().method !== 'GET') { <label class="d-flex gap-2 mb-2"><input type="checkbox" [(ngModel)]="ack" /> I understand this {{ op().method }} request changes real data.</label> }
        @if (!run()) { <button type="button" class="btn-hr primary" [disabled]="op().method !== 'GET' && !ack" (click)="run.set(true)"><i class="pi pi-play"></i>{{ 'common.executeRequest' | translate }}</button> }
        @else { <app-op-form [op]="op().id" [successMessage]="false" formId="explorer-form" (done)="result.set($event ?? '(no content)')" /><button type="submit" form="explorer-form" class="btn-hr primary mt-3">{{ 'common.executeRequest' | translate }}</button> }
        @if (result() !== undefined) { <pre class="mt-3 rounded-2 p-3" style="max-height:320px;overflow:auto;font-size:11px;background:var(--hr-surface-2)">{{ shown() }}</pre> }</div> }
      @else { <div class="text-muted">{{ blocked() ? 'Not executable here: it would end your own session.' : op().binary ? 'Binary download - use the related UI.' : ('common.notAuthorized' | translate) }}</div> }</div></app-modal>`,
})
export class EndpointDetailsComponent {
  private perm = inject(PermissionService);
  op = input.required<OperationDef>(); closed = output<void>(); ack = false; run = signal(false); result = signal<any>(undefined);
  cov = computed(() => COVERAGE_MAP[this.op().id]); route = computed(() => MODULE_ROUTE[this.cov()?.module ?? ''] ?? '/');
  blocked = computed(() => BLOCKED.has(this.op().id));
  canRun = computed(() => this.perm.isAdmin() && this.perm.canCall(this.op().id) && !this.blocked() && !this.op().binary);
  body = computed(() => props(this.op().bodySchema));
  params = computed(() => [...this.op().pathParams.map((n) => ({ name: n, in: 'path', type: 'string', required: true })), ...this.op().query.map((q) => ({ name: q.name, in: 'query', type: q.schema.enum ? q.schema.enum.join(' | ') : q.schema.type, required: q.required }))]);
  shown = computed(() => JSON.stringify(mask(this.result()), null, 2));
}

/** Administrative API Explorer: every backend endpoint with its contract, authorization, related UI and integration status; admins can run controlled requests. */
@Component({
  selector: 'app-api-explorer-page', standalone: true, changeDetection: ChangeDetectionStrategy.Default,
  imports: [FormsModule, TranslateModule, PageHeaderComponent, DataTableComponent, BadgeComponent, CellDirective, ServiceHealthComponent, EndpointDetailsComponent],
  template: `<app-page-header [title]="'hr.admin.explorer' | translate" [subtitle]="total + ' endpoints · ' + ('hr.admin.explorerSub' | translate)" />
  <app-service-health />
  <app-data-table id="explorer" [rows]="rows()" exportName="api-endpoints" [searchable]="true" [rowClickable]="true" (rowClick)="open.set($event)" (searchChange)="q.set($event)" [columns]="cols">
    <ng-template appCell="method" let-r><app-badge [tone]="tone(r.method)">{{ r.method }}</app-badge></ng-template>
    <ng-template appCell="path" let-r><code style="font-size:12px">{{ r.path }}</code></ng-template>
    <ng-template appCell="authorize" let-r>@if (r.public) { <app-badge>public</app-badge> } @else if (r.authorize) { <app-badge tone="warning">restricted</app-badge> } @else { <app-badge>authenticated</app-badge> }</ng-template>
    <ng-template appCell="cov" let-r><app-badge [tone]="cov(r.id)?.status === 'not-integrated' ? 'danger' : 'success'">{{ cov(r.id)?.status ?? '—' }}</app-badge></ng-template>
    <span toolbar class="contents"><select class="form-select" style="width:auto" [ngModel]="f().service" (ngModelChange)="set('service', $event)" aria-label="service"><option value="">All services</option>@for (s of services; track s) { <option>{{ s }}</option> }</select>
      <select class="form-select" style="width:auto" [ngModel]="f().method" (ngModelChange)="set('method', $event)" aria-label="method"><option value="">Method</option>@for (m of methods; track m) { <option>{{ m }}</option> }</select>
      <select class="form-select" style="width:auto" [ngModel]="f().status" (ngModelChange)="set('status', $event)" aria-label="status"><option value="">Integration</option><option value="integrated">integrated</option><option value="infrastructure">infrastructure</option><option value="not-integrated">not integrated</option></select></span>
  </app-data-table>
  @if (open(); as o) { <app-endpoint-details [op]="o" (closed)="open.set(null)" /> }`,
})
export class ApiExplorerPage {
  total = OPERATIONS.length; services = SERVICES; methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
  q = signal(''); f = signal({ service: '', method: '', status: '' }); open = signal<OperationDef | null>(null);
  cov = (id: string) => COVERAGE_MAP[id]; tone = (m: string): Tone => METHOD_TONE[m] ?? 'neutral';
  set(k: 'service' | 'method' | 'status', v: string) { this.f.set({ ...this.f(), [k]: v }); }
  cols: Col[] = [{ key: 'method', width: '80px' }, { key: 'path' }, { key: 'service' }, { key: 'tag' }, { key: 'summary' }, { key: 'authorize', label: 'Authorization' },
    { key: 'ui', label: 'Related UI', fmt: (_v, r) => COVERAGE_MAP[r.id]?.module ?? '—' }, { key: 'cov', label: 'Status' }, { key: 'id', hidden: true }];
  rows = computed(() => { const f = this.f(); const q = this.q().toLowerCase(); return OPERATIONS.filter((o) => (!f.service || o.service === f.service) && (!f.method || o.method === f.method) && (!f.status || COVERAGE_MAP[o.id]?.status === f.status) && (!q || `${o.path} ${o.summary} ${o.tag} ${o.id}`.toLowerCase().includes(q))); });
}
export default ApiExplorerPage;
