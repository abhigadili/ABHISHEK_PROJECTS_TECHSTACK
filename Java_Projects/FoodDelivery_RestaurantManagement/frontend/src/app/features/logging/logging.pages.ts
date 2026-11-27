import { Component, Input, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { DatePipe, KeyValuePipe } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialog } from '@angular/material/dialog';
import { ActivatedRoute } from '@angular/router';
import { interval, Subscription } from 'rxjs';
import { MonitoringApi } from '../../core/services/ops-api';
import { UI } from '../../shared/material';
import { EmptyComponent, PageHeaderComponent, StatusChipComponent } from '../../shared/components/small.components';

@Component({
  selector: 'app-log-detail', imports: [UI, DatePipe, StatusChipComponent],
  template: `<h2 mat-dialog-title><app-status [value]="e.level" /> {{ e.service }}</h2><mat-dialog-content style="min-width:min(760px,90vw)">
    <div class="muted">{{ e['@timestamp'] | date: 'medium' }} · logger <span class="mono">{{ e.logger }}</span> · thread {{ e.thread }}</div>
    <p style="white-space:pre-wrap">{{ e.message }}</p>
    <table class="simple"><tbody><tr><td>Correlation id</td><td class="mono">{{ e.correlationId }}</td></tr><tr><td>Trace id</td><td class="mono">{{ e.traceId }}</td></tr><tr><td>Category</td><td>{{ e.category }}</td></tr>
      @if (e.httpPath) { <tr><td>HTTP</td><td>{{ e.httpMethod }} {{ e.httpPath }} → {{ e.httpStatus }} ({{ e.durationMs }} ms)</td></tr> } @if (e.eventId) { <tr><td>Event id</td><td class="mono">{{ e.eventId }}</td></tr> }</tbody></table>
    @if (e.error?.class) { <h3 class="bad">{{ e.error.class }}: {{ e.error.message }}</h3><pre class="json">{{ e.error.stack }}</pre> }</mat-dialog-content>
  <mat-dialog-actions align="end"><button mat-button mat-dialog-close>Close</button></mat-dialog-actions>`
})
export class LogDetailDialog { e = inject<any>(MAT_DIALOG_DATA); }

/** Shared table of log lines. */
@Component({
  selector: 'app-log-table', imports: [UI, DatePipe, StatusChipComponent],
  template: `<div class="scroll-x"><table class="simple"><thead><tr><th>Time</th><th>Level</th><th>Service</th><th>Category</th><th>Message</th><th>Correlation id</th></tr></thead><tbody>
    @for (h of hits; track h.id) { <tr style="cursor:pointer" (click)="open(h)"><td style="white-space:nowrap">{{ h['@timestamp'] | date: 'dd MMM HH:mm:ss.SSS' }}</td><td><app-status [value]="h.level" /></td><td>{{ h.service }}</td><td class="muted">{{ h.category }}</td>
      <td style="max-width:520px;overflow:hidden;text-overflow:ellipsis">{{ h.message }}@if (h.error?.class) { <div class="bad mono">{{ h.error.class }}</div> }</td><td class="mono">{{ h.correlationId }}</td></tr> }
    @empty { <tr><td colspan="6" class="muted" style="text-align:center;padding:24px">No log entries</td></tr> }</tbody></table></div>`
})
export class LogTableComponent {
  @Input() hits: any[] = [];
  private api = inject(MonitoringApi); private dialog = inject(MatDialog);
  open(h: any) { this.api.logEntry(h.index, h.id).subscribe(e => this.dialog.open(LogDetailDialog, { data: e, maxWidth: '95vw' })); }
}

// ============================================================================================ health + overview
@Component({
  selector: 'app-observability', imports: [UI, KeyValuePipe, DatePipe, PageHeaderComponent, StatusChipComponent, LogTableComponent],
  template: `<div class="page"><app-page-header title="Observability" subtitle="Service health (Eureka + Actuator) and a log overview for the selected window">
      <mat-form-field style="width:150px"><mat-label>Window</mat-label><mat-select [(ngModel)]="minutes" (selectionChange)="loadLogs()"><mat-option [value]="15">15 minutes</mat-option><mat-option [value]="60">1 hour</mat-option><mat-option [value]="360">6 hours</mat-option><mat-option [value]="1440">24 hours</mat-option></mat-select></mat-form-field>
      @if (kibana()) { <a mat-flat-button color="primary" [href]="kibana()" target="_blank" rel="noopener"><mat-icon>open_in_new</mat-icon> Open Kibana</a> }</app-page-header>
    <h2>Microservice health <span class="muted" style="font-size:12px">refreshes every 10 s</span></h2>
    <div class="scroll-x"><table class="simple"><thead><tr><th>Service</th><th>Status</th><th>URL</th><th>Port</th><th>Database</th><th>Redis</th><th>Kafka</th><th>Last check</th></tr></thead><tbody>
      @for (s of health(); track s.service + s.instanceId) { <tr><td><b>{{ s.service }}</b></td><td><app-status [value]="s.status" />@if (s.reason) { <span class="muted"> {{ s.reason }}</span> }</td><td class="mono">{{ s.url }}</td><td>{{ s.port }}</td>
        <td>@if (s.database) {<app-status [value]="s.database" />}</td><td>@if (s.redis) {<app-status [value]="s.redis" />}</td><td>@if (s.kafka) {<app-status [value]="s.kafka" />}</td><td class="muted">{{ s.checkedAt | date: 'HH:mm:ss' }}</td></tr> }</tbody></table></div>
    @if (ov(); as o) {
      <h2>Logs in the last window</h2>
      <div class="grid-sm" style="margin-bottom:12px"><div class="card"><div class="stat-label">Total log lines</div><div class="stat">{{ o.total }}</div></div>
        <div class="card"><div class="stat-label">Errors</div><div class="stat bad">{{ o.byLevel?.ERROR ?? 0 }}</div></div><div class="card"><div class="stat-label">Warnings</div><div class="stat warn">{{ o.byLevel?.WARN ?? 0 }}</div></div><div class="card"><div class="stat-label">Info</div><div class="stat">{{ o.byLevel?.INFO ?? 0 }}</div></div></div>
      <div class="row" style="align-items:flex-start;gap:16px"><div class="card grow" style="min-width:260px"><h3 style="margin-top:0">By service</h3>
        @for (e of o.byService | keyvalue; track e.key) { <div class="row"><span>{{ e.key }}</span><div style="flex:1;height:8px;background:#f3f4f6;border-radius:4px"><div [style.width.%]="(100 * $any(e.value)) / max(o.byService)" style="height:8px;background:#fb923c;border-radius:4px"></div></div><b>{{ e.value }}</b></div> }</div>
        <div class="card grow" style="min-width:260px"><h3 style="margin-top:0">By category</h3>@for (e of o.byCategory | keyvalue; track e.key) { <div class="row"><span class="chip gray">{{ e.key }}</span><b class="right">{{ e.value }}</b></div> }</div></div>
      <h2>Recent errors</h2><app-log-table [hits]="o.recentErrors" /> }</div>`
})
export class ObservabilityComponent implements OnInit, OnDestroy {
  private api = inject(MonitoringApi);
  health = signal<any[]>([]); ov = signal<any>(null); kibana = signal(''); minutes = 60; private sub?: Subscription;
  ngOnInit() {
    this.loadHealth(); this.loadLogs(); this.api.logConfig().subscribe(c => this.kibana.set(c.kibanaUrl + '/app/dashboards#/view/fd-dashboard'));
    this.sub = interval(10000).subscribe(() => this.loadHealth());
  }
  ngOnDestroy() { this.sub?.unsubscribe(); }
  loadHealth() { this.api.health().subscribe(h => this.health.set(h.sort((a, b) => a.service.localeCompare(b.service)))); }
  loadLogs() { this.api.logOverview(this.minutes).subscribe({ next: o => this.ov.set(o), error: () => this.ov.set(null) }); }
  max(o: Record<string, number>) { return Math.max(1, ...Object.values(o ?? {})); }
}

// ============================================================================================ log search
@Component({
  selector: 'app-log-search', imports: [UI, PageHeaderComponent, LogTableComponent],
  template: `<div class="page"><app-page-header title="Log search" subtitle="Elasticsearch, queried through a controlled admin API (Angular never talks to Elasticsearch)" />
    <div class="card row" style="margin-bottom:12px">
      <mat-form-field style="width:240px"><mat-label>Correlation id</mat-label><input matInput [(ngModel)]="correlationId" (keyup.enter)="go(0)" placeholder="paste the X-Correlation-Id"></mat-form-field>
      <mat-form-field style="width:220px"><mat-label>Trace id</mat-label><input matInput [(ngModel)]="traceId" (keyup.enter)="go(0)"></mat-form-field>
      <mat-form-field style="width:220px"><mat-label>Text in message / exception</mat-label><input matInput [(ngModel)]="q" (keyup.enter)="go(0)"></mat-form-field>
      <mat-form-field style="width:170px"><mat-label>Service</mat-label><mat-select [(ngModel)]="service"><mat-option value="">All</mat-option>@for (s of services; track s) {<mat-option [value]="s">{{ s }}</mat-option>}</mat-select></mat-form-field>
      <mat-form-field style="width:120px"><mat-label>Level</mat-label><mat-select [(ngModel)]="level"><mat-option value="">All</mat-option><mat-option value="ERROR">ERROR</mat-option><mat-option value="WARN">WARN</mat-option><mat-option value="INFO">INFO</mat-option><mat-option value="DEBUG">DEBUG</mat-option></mat-select></mat-form-field>
      <mat-form-field style="width:190px"><mat-label>Focus</mat-label><mat-select [(ngModel)]="category"><mat-option value="">Everything</mat-option><mat-option value="kafka-producer">Kafka producer logs</mat-option><mat-option value="kafka-consumer">Kafka consumer logs</mat-option><mat-option value="redis-cache">Redis cache activity</mat-option>
        <mat-option value="order-lifecycle">Order lifecycle</mat-option><mat-option value="payment">Payment events</mat-option><mat-option value="api-request">API requests</mat-option></mat-select></mat-form-field>
      <mat-form-field style="width:150px"><mat-label>Time range</mat-label><mat-select [(ngModel)]="minutes"><mat-option [value]="15">Last 15 min</mat-option><mat-option [value]="60">Last hour</mat-option><mat-option [value]="1440">Last 24 h</mat-option><mat-option [value]="10080">Last 7 days</mat-option></mat-select></mat-form-field>
      <button mat-flat-button color="primary" (click)="go(0)"><mat-icon>search</mat-icon> Search</button><button mat-button (click)="reset()">Reset</button></div>
    <div class="muted" style="margin-bottom:8px">{{ total() }} matching entries @if (correlationId) { · showing the whole request path oldest-first }</div>
    <app-log-table [hits]="hits()" />
    <mat-paginator [length]="total()" [pageSize]="50" [pageIndex]="page()" [hidePageSize]="true" (page)="go($event.pageIndex)" /></div>`
})
export class LogSearchComponent implements OnInit {
  private api = inject(MonitoringApi); private route = inject(ActivatedRoute);
  hits = signal<any[]>([]); total = signal(0); page = signal(0);
  correlationId = ''; traceId = ''; q = ''; service = ''; level = ''; category = ''; minutes = 60;
  services = ['api-gateway', 'user-service', 'customer-service', 'restaurant-service', 'menu-service', 'cart-service', 'order-service', 'payment-service', 'delivery-service', 'notification-service', 'review-service', 'coupon-service', 'inventory-service', 'search-service', 'admin-service', 'event-audit-service'];
  ngOnInit() { this.correlationId = this.route.snapshot.queryParamMap.get('correlationId') ?? ''; this.go(0); }
  reset() { this.correlationId = this.traceId = this.q = this.service = this.level = this.category = ''; this.go(0); }
  go(p: number) {
    const from = new Date(Date.now() - this.minutes * 60000).toISOString();
    this.api.logs({ correlationId: this.correlationId.trim(), traceId: this.traceId.trim(), q: this.q, service: this.service, level: this.level, category: this.category, from: this.correlationId.trim() ? undefined : from, page: p, size: 50 })
      .subscribe(r => { this.hits.set(r.hits); this.total.set(r.total); this.page.set(r.page); });
  }
}
