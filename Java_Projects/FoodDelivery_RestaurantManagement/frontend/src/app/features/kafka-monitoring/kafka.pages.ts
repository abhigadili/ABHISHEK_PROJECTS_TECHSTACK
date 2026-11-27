import { Component, Input, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { interval, Subscription } from 'rxjs';
import { MonitoringApi } from '../../core/services/ops-api';
import { AuthService } from '../../core/auth/auth.service';
import { UI } from '../../shared/material';
import { EmptyComponent, JsonViewComponent, PageHeaderComponent, StatusChipComponent } from '../../shared/components/small.components';
import { Col, DataTableComponent } from '../../shared/components/data-table.component';

// ============================================================================================ topics
@Component({
  selector: 'app-kafka-topics', imports: [UI, PageHeaderComponent, StatusChipComponent],
  template: `<div class="page"><app-page-header title="Kafka topics" subtitle="Metadata read from the broker with AdminClient; producers/consumers come from the code of the running services">
      @if (cluster(); as c) { <span class="chip blue">cluster {{ c.clusterId }}</span><span class="chip gray">{{ c.brokers }} broker(s)</span> }<button mat-stroked-button (click)="load()"><mat-icon>refresh</mat-icon></button></app-page-header>
    <div class="row" style="margin-bottom:8px"><mat-form-field style="width:260px"><mat-label>Filter topics</mat-label><input matInput [(ngModel)]="q"></mat-form-field><mat-checkbox [(ngModel)]="showDlt">Show dead-letter topics</mat-checkbox><mat-checkbox [(ngModel)]="showTech">Show technical (audit.*)</mat-checkbox></div>
    <div class="scroll-x"><table class="simple"><thead><tr><th>Topic</th><th>Purpose</th><th>Partitions</th><th>RF</th><th>Retention</th><th>Messages</th><th>Producers</th><th>Consumers</th><th>Groups</th><th>Status</th></tr></thead><tbody>
      @for (t of visible(); track t.name) { <tr style="cursor:pointer" (click)="open(t.name)"><td><b class="mono">{{ t.name }}</b></td><td class="muted" style="max-width:260px">{{ t.description }}</td><td>{{ t.partitions }}</td><td>{{ t.replicationFactor }}</td>
        <td>{{ days(t.config['retention.ms']) }}</td><td>{{ t.messageCount }}</td><td>@for (p of t.producers; track p) {<div class="muted">{{ p }}</div>}</td><td>@for (p of t.consumers; track p) {<div class="muted">{{ p }}</div>}</td>
        <td>{{ t.consumerGroups.length }}</td><td><app-status [value]="t.status" /></td></tr> }</tbody></table></div></div>`
})
export class KafkaTopicsComponent implements OnInit {
  private api = inject(MonitoringApi); private router = inject(Router);
  topics = signal<any[]>([]); cluster = signal<any>(null); q = ''; showDlt = false; showTech = false;
  visible = () => this.topics().filter(t => (this.showDlt || !t.deadLetter) && (this.showTech || !t.name.startsWith('audit.')) && t.name.includes(this.q.trim()));
  ngOnInit() { this.load(); }
  load() { this.api.topics().subscribe(t => this.topics.set(t)); this.api.cluster().subscribe(c => this.cluster.set(c)); }
  days(ms?: string) { return ms ? Math.round(Number(ms) / 86400000 * 10) / 10 + ' d' : '–'; }
  open(n: string) { this.router.navigate(['/kafka/topics', n]); }
}

@Component({
  selector: 'app-message-dialog', imports: [UI, DatePipe, JsonViewComponent],
  template: `<h2 mat-dialog-title>{{ m.eventType || 'Message' }} <span class="muted mono">{{ m.topic }}-{{ m.partition }}&#64;{{ m.offset }}</span></h2>
    <mat-dialog-content style="min-width:min(680px,88vw)"><div class="muted">key <b class="mono">{{ m.key }}</b> · {{ m.timestamp | date: 'medium' }} · producer {{ m.producerService }} · correlation <span class="mono">{{ m.correlationId }}</span></div>
      <h3>Headers</h3><app-json [value]="m.headers" /><h3>Value @if (m.masked) {<span class="chip amber">sensitive fields masked</span>}</h3><app-json [value]="m.value" /></mat-dialog-content>
    <mat-dialog-actions align="end"><button mat-button mat-dialog-close>Close</button></mat-dialog-actions>`
})
export class MessageDialog { m = inject<any>(MAT_DIALOG_DATA); }

@Component({
  selector: 'app-kafka-topic', imports: [UI, DatePipe, PageHeaderComponent, StatusChipComponent, JsonViewComponent],
  template: `<div class="page"><app-page-header [title]="name" [subtitle]="d()?.summary?.description ?? ''"><a mat-stroked-button routerLink="/kafka/topics">Back</a></app-page-header>
    @if (d(); as d) {
      <div class="grid-sm" style="margin-bottom:12px"><div class="card"><div class="stat-label">Partitions</div><div class="stat">{{ d.summary.partitions }}</div></div><div class="card"><div class="stat-label">Replication factor</div><div class="stat">{{ d.summary.replicationFactor }}</div></div>
        <div class="card"><div class="stat-label">Messages retained</div><div class="stat">{{ d.summary.messageCount }}</div></div><div class="card"><div class="stat-label">Status</div><app-status [value]="d.summary.status" /></div></div>
      <mat-tab-group>
        <mat-tab label="Messages"><div style="margin-top:12px"><div class="row"><mat-form-field style="width:130px"><mat-label>Partition</mat-label><mat-select [(ngModel)]="partition" (selectionChange)="loadMessages()"><mat-option [value]="null">All</mat-option>@for (p of d.partitionDetails; track p.partition) {<mat-option [value]="p.partition">{{ p.partition }}</mat-option>}</mat-select></mat-form-field>
          <mat-form-field style="width:120px"><mat-label>Latest N</mat-label><mat-select [(ngModel)]="limit" (selectionChange)="loadMessages()"><mat-option [value]="20">20</mat-option><mat-option [value]="50">50</mat-option><mat-option [value]="100">100</mat-option></mat-select></mat-form-field>
          <mat-form-field style="width:260px"><mat-label>Filter (key, event id, text)</mat-label><input matInput [(ngModel)]="filter"></mat-form-field><button mat-stroked-button (click)="loadMessages()"><mat-icon>refresh</mat-icon></button></div>
          <table class="simple"><thead><tr><th>P</th><th>Offset</th><th>Key</th><th>Event type</th><th>Producer</th><th>Time</th></tr></thead><tbody>
            @for (m of filtered(); track m.partition + '-' + m.offset) { <tr style="cursor:pointer" (click)="show(m)"><td>{{ m.partition }}</td><td>{{ m.offset }}</td><td class="mono">{{ m.key }}</td><td>{{ m.eventType }}</td><td>{{ m.producerService }}</td><td>{{ m.timestamp | date: 'dd MMM HH:mm:ss' }}</td></tr> }</tbody></table></div></mat-tab>
        <mat-tab label="Partitions"><table class="simple" style="margin-top:12px"><thead><tr><th>Partition</th><th>Leader</th><th>Replicas</th><th>ISR</th><th>Begin offset</th><th>End offset</th></tr></thead><tbody>
          @for (p of d.partitionDetails; track p.partition) {<tr><td>{{ p.partition }}</td><td>{{ p.leader }}</td><td>{{ p.replicas }}</td><td>{{ p.isr }}</td><td>{{ p.beginOffset }}</td><td>{{ p.endOffset }}</td></tr>}</tbody></table></mat-tab>
        <mat-tab label="Configuration & wiring"><div style="margin-top:12px"><h3>Topic configuration</h3><app-json [value]="d.summary.config" />
          <h3>Producers and consumers (discovered from code)</h3><table class="simple"><thead><tr><th>Role</th><th>Service</th><th>Class</th><th>Method</th><th>Consumer group</th></tr></thead><tbody>
            @for (t of d.topology; track $index) {<tr><td><app-status [value]="t.role" /></td><td>{{ t.service }}</td><td class="mono">{{ t.className }}</td><td class="mono">{{ t.method }}</td><td class="mono">{{ t.groupId }}</td></tr>}</tbody></table></div></mat-tab>
      </mat-tab-group> }</div>`
})
export class KafkaTopicComponent implements OnInit {
  @Input() name = '';          // route param via withComponentInputBinding
  private api = inject(MonitoringApi); private dialog = inject(MatDialog);
  d = signal<any>(null); msgs = signal<any[]>([]); partition: number | null = null; limit = 50; filter = '';
  filtered = () => this.msgs().filter(m => !this.filter || JSON.stringify([m.key, m.eventId, m.eventType, m.value]).toLowerCase().includes(this.filter.toLowerCase()));
  ngOnInit() { this.api.topic(this.name).subscribe(d => this.d.set(d)); this.loadMessages(); }
  loadMessages() { this.api.messages(this.name, { partition: this.partition, limit: this.limit }).subscribe(m => this.msgs.set(m)); }
  show(m: any) { this.dialog.open(MessageDialog, { data: m, maxWidth: '95vw' }); }
}

// ============================================================================================ audit history (messages + processing status)
@Component({
  selector: 'app-audit-detail', imports: [UI, DatePipe, StatusChipComponent, JsonViewComponent],
  template: `<h2 mat-dialog-title>{{ a.eventType }} <app-status [value]="a.status" /></h2><mat-dialog-content style="min-width:min(700px,88vw)">
    <table class="simple"><tbody>
      <tr><td>Event id</td><td class="mono">{{ a.eventId }}</td></tr><tr><td>Topic / partition / offset</td><td class="mono">{{ a.topic }} / {{ a.partition }} / {{ a.offset }}</td></tr><tr><td>Key</td><td class="mono">{{ a.key }}</td></tr>
      <tr><td>Produced by</td><td>{{ a.producerService }}</td></tr>
      @if (a.role === 'CONSUMED') { <tr><td>Consumer</td><td>{{ a.consumerService }} / <span class="mono">{{ a.consumerClass }}</span> (group <span class="mono">{{ a.consumerGroup }}</span>)</td></tr><tr><td>Attempts / duration</td><td>{{ a.attempts }} / {{ a.durationMs }} ms</td></tr><tr><td>Processed at</td><td>{{ a.processedAt | date: 'medium' }}</td></tr> }
      <tr><td>Event time</td><td>{{ a.eventTimestamp | date: 'medium' }}</td></tr><tr><td>Correlation id</td><td class="mono">{{ a.correlationId }}</td></tr>
      @if (a.error) { <tr><td>Error</td><td class="bad">{{ a.error }}</td></tr> }</tbody></table>
    <h3>Payload (masked)</h3>@if (a.payload) { <app-json [value]="a.payload" /> } @else { <div class="muted">No payload stored</div> }
    @if (trace().length) { <h3>Related events (same correlation id)</h3>@for (t of trace(); track t.id) { <div><app-status [value]="t.status" /> <b>{{ t.eventType }}</b> <span class="muted">{{ t.role === 'CONSUMED' ? t.consumerService : t.producerService }} · {{ t.eventTimestamp | date: 'HH:mm:ss.SSS' }}</span></div> } }</mat-dialog-content>
  <mat-dialog-actions align="end">@if (canReplay) { <button mat-flat-button color="warn" (click)="replay()">Replay original message</button> }<button mat-button mat-dialog-close>Close</button></mat-dialog-actions>`
})
export class AuditDetailDialog implements OnInit {
  a = inject<any>(MAT_DIALOG_DATA); private api = inject(MonitoringApi); private auth = inject(AuthService); private snack = inject(MatSnackBar);
  trace = signal<any[]>([]);
  get canReplay() { return this.a.role === 'CONSUMED' && ['FAILED', 'DEAD_LETTERED'].includes(this.a.status) && this.auth.can('KAFKA_REPLAY'); }
  ngOnInit() { if (this.a.correlationId) this.api.trace(this.a.correlationId).subscribe(t => this.trace.set(t.filter(x => x.id !== this.a.id))); }
  replay() { this.api.replay(this.a.id).subscribe(r => this.snack.open(r.message, 'Close', { duration: 6000 })); }
}

@Component({
  selector: 'app-kafka-audit', imports: [UI, PageHeaderComponent, DataTableComponent],
  template: `<div class="page"><app-page-header title="Message history & event audit" subtitle="Persistent audit store: what was published, and what each consumer group REALLY did with it (published ≠ consumed)" />
    <div class="card row" style="margin-bottom:12px">
      <mat-form-field style="width:160px"><mat-label>View</mat-label><mat-select [(ngModel)]="role" (selectionChange)="load(0)"><mat-option value="">Everything</mat-option><mat-option value="PUBLISHED">Published</mat-option><mat-option value="CONSUMED">Consumed (processing)</mat-option></mat-select></mat-form-field>
      <mat-form-field style="width:190px"><mat-label>Topic</mat-label><mat-select [(ngModel)]="topic" (selectionChange)="load(0)"><mat-option value="">All</mat-option>@for (t of topics(); track t) {<mat-option [value]="t">{{ t }}</mat-option>}</mat-select></mat-form-field>
      <mat-form-field style="width:170px"><mat-label>Status</mat-label><mat-select [(ngModel)]="status" (selectionChange)="load(0)"><mat-option value="">Any</mat-option>@for (s of statuses; track s) {<mat-option [value]="s">{{ s }}</mat-option>}</mat-select></mat-form-field>
      <mat-form-field style="width:170px"><mat-label>Event type</mat-label><input matInput [(ngModel)]="eventType" (keyup.enter)="load(0)" placeholder="OrderCreated"></mat-form-field>
      <mat-form-field style="width:190px"><mat-label>Service</mat-label><input matInput [(ngModel)]="service" (keyup.enter)="load(0)" placeholder="payment-service"></mat-form-field>
      <mat-form-field style="width:230px"><mat-label>Search (event id, key, correlation, payload)</mat-label><input matInput [(ngModel)]="q" (keyup.enter)="load(0)"></mat-form-field>
      <mat-form-field style="width:200px"><mat-label>From</mat-label><input matInput type="datetime-local" [(ngModel)]="from"></mat-form-field><mat-form-field style="width:200px"><mat-label>To</mat-label><input matInput type="datetime-local" [(ngModel)]="to"></mat-form-field>
      <button mat-flat-button color="primary" (click)="load(0)">Search</button></div>
    @if (stats(); as s) { <div class="row" style="margin-bottom:8px"><span class="chip blue">{{ s.published }} published</span>@for (e of entries(s.consumedByStatus); track e[0]) {<span class="chip" [class.green]="e[0] === 'PROCESSED'" [class.red]="e[0] === 'DEAD_LETTERED' || e[0] === 'FAILED'">{{ e[1] }} {{ e[0] }}</span>}</div> }
    <app-table [cols]="cols" [rows]="rows()" [total]="total()" [page]="page()" [size]="25" [rowClickable]="true" (rowClick)="open($event)" (pageChange)="load($event.pageIndex)" /></div>`
})
export class KafkaAuditComponent implements OnInit {
  private api = inject(MonitoringApi); private dialog = inject(MatDialog);
  rows = signal<any[]>([]); total = signal(0); page = signal(0); topics = signal<string[]>([]); stats = signal<any>(null);
  role = ''; topic = ''; status = ''; eventType = ''; service = ''; q = ''; from = ''; to = '';
  statuses = ['PUBLISHED', 'PROCESSED', 'DUPLICATE_IGNORED', 'FAILED', 'DEAD_LETTERED', 'REJECTED_INVALID'];
  cols: Col[] = [{ key: 'eventTimestamp', label: 'Time', type: 'date' }, { key: 'role', label: 'Kind' }, { key: 'topic', label: 'Topic', type: 'mono' }, { key: 'partition', label: 'P' }, { key: 'offset', label: 'Offset' }, { key: 'key', label: 'Key', type: 'mono' },
    { key: 'eventType', label: 'Event' }, { key: 'producerService', label: 'Producer' }, { key: 'consumerService', label: 'Consumer' }, { key: 'consumerClass', label: 'Consumer class', type: 'mono' }, { key: 'status', label: 'Status', type: 'chip' }, { key: 'durationMs', label: 'ms' }, { key: 'attempts', label: 'Tries' }];
  entries = (o: Record<string, number>) => Object.entries(o ?? {});
  ngOnInit() { this.api.topics().subscribe(t => this.topics.set(t.filter(x => !x.deadLetter && !x.name.startsWith('audit.')).map(x => x.name))); this.load(0); }
  load(p: number) {
    const iso = (v: string) => (v ? new Date(v).toISOString() : undefined);
    this.api.audit({ role: this.role, topic: this.topic, status: this.status, eventType: this.eventType, service: this.service, q: this.q, from: iso(this.from), to: iso(this.to), page: p, size: 25 })
      .subscribe(r => { this.rows.set(r.content); this.total.set(r.totalElements); this.page.set(r.page); });
    this.api.auditStats().subscribe(s => this.stats.set(s));
  }
  open(a: any) { this.api.auditEvent(a.id).subscribe(d => this.dialog.open(AuditDetailDialog, { data: d, maxWidth: '95vw' })); }
}

// ============================================================================================ producers / consumers + flow
@Component({
  selector: 'app-kafka-flow', imports: [UI, PageHeaderComponent],
  template: `<div class="page"><app-page-header title="Event flow" subtitle="Producer service → Kafka topic → Consumer service. Built from the real @EventProducer / @KafkaListener wiring of the running services." />
    <div class="card scroll-x">
      <svg [attr.width]="W" [attr.height]="H" style="font-family:Roboto,sans-serif">
        <defs><marker id="arr" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#9ca3af" /></marker></defs>
        @for (e of edges(); track $index) { <path [attr.d]="path(e)" fill="none" [attr.stroke]="sel() && !touch(e) ? '#e5e7eb' : e.via === 'produces' ? '#f97316' : '#3b82f6'" stroke-width="1.4" marker-end="url(#arr)" /> }
        @for (n of nodes(); track n.id) {
          <g (click)="pick(n.id)" style="cursor:pointer" [attr.opacity]="sel() && !related(n.id) ? .25 : 1">
            <rect [attr.x]="n.x" [attr.y]="n.y" [attr.width]="n.type === 'service' ? 170 : 200" height="24" rx="6" [attr.fill]="n.type === 'service' ? '#fef3c7' : '#dbeafe'" [attr.stroke]="sel() === n.id ? '#111' : '#9ca3af'" />
            <text [attr.x]="n.x + 8" [attr.y]="n.y + 16" font-size="11">{{ n.label }}</text></g> }
        <text x="10" y="14" font-size="12" fill="#6b7280">PRODUCERS</text><text [attr.x]="midX + 10" y="14" font-size="12" fill="#6b7280">TOPICS</text><text [attr.x]="rightX + 10" y="14" font-size="12" fill="#6b7280">CONSUMERS</text></svg></div>
    @if (sel()) { <div class="card" style="margin-top:12px"><b>{{ sel() }}</b><div class="muted">Click again elsewhere to clear. Connected edges:</div>
      @for (e of edgesOf(); track $index) { <div class="mono">{{ e.from }} → {{ e.to }} <span class="muted">({{ e.via }} · {{ e.className }})</span></div> }</div> }
    <h2>Mapping table</h2>
    <table class="simple"><thead><tr><th>Producer service</th><th>Producer class</th><th>Topic</th><th>Consumer service</th><th>Consumer class [group]</th></tr></thead><tbody>
      @for (r of table(); track $index) {<tr><td>{{ r[0] }}</td><td class="mono">{{ r[1] }}</td><td class="mono"><b>{{ r[2] }}</b></td><td>{{ r[3] }}</td><td class="mono">{{ r[4] }}</td></tr>}</tbody></table></div>`
})
export class KafkaFlowComponent implements OnInit {
  private api = inject(MonitoringApi);
  nodes = signal<any[]>([]); edges = signal<any[]>([]); sel = signal<string | null>(null);
  W = 1000; H = 600; midX = 380; rightX = 780;
  table = signal<string[][]>([]);
  ngOnInit() {
    this.api.flow().subscribe(f => {
      const producers = f.nodes.filter((n: any) => n.type === 'service' && f.edges.some((e: any) => e.from === n.id)).sort((a: any, b: any) => a.label.localeCompare(b.label));
      const consumers = f.nodes.filter((n: any) => n.type === 'service' && f.edges.some((e: any) => e.to === n.id)).sort((a: any, b: any) => a.label.localeCompare(b.label));
      const topics = f.nodes.filter((n: any) => n.type === 'topic').sort((a: any, b: any) => a.label.localeCompare(b.label));
      const pos: any[] = [];
      producers.forEach((n: any, i: number) => pos.push({ ...n, id: n.id + '|P', x: 10, y: 30 + i * 38 }));
      topics.forEach((n: any, i: number) => pos.push({ ...n, x: this.midX, y: 30 + i * 26 }));
      consumers.forEach((n: any, i: number) => pos.push({ ...n, id: n.id + '|C', x: this.rightX, y: 30 + i * 38 }));
      this.H = Math.max(producers.length * 38, topics.length * 26, consumers.length * 38) + 50;
      this.nodes.set(pos);
      this.edges.set(f.edges.map((e: any) => (e.via === 'produces' ? { ...e, from: e.from + '|P' } : { ...e, to: e.to + '|C' })));
      const rows: string[][] = [];
      for (const t of topics) {
        const prod = f.edges.filter((e: any) => e.to === t.id), cons = f.edges.filter((e: any) => e.from === t.id);
        const n = Math.max(prod.length, cons.length, 1);
        for (let i = 0; i < n; i++) rows.push([prod[i]?.from.replace('svc:', '') ?? '', prod[i]?.className ?? '', t.label, cons[i]?.to.replace('svc:', '') ?? '', cons[i]?.className ?? '']);
      }
      this.table.set(rows);
    });
  }
  private by(id: string) { return this.nodes().find(n => n.id === id); }
  path(e: any) {
    const a = this.by(e.from), b = this.by(e.to); if (!a || !b) return '';
    const x1 = a.x + (a.type === 'service' ? 170 : 200), y1 = a.y + 12, x2 = b.x, y2 = b.y + 12, mx = (x1 + x2) / 2;
    return `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`;
  }
  pick(id: string) { this.sel.set(this.sel() === id ? null : id); }
  touch(e: any) { return e.from === this.sel() || e.to === this.sel(); }
  related(id: string) { return id === this.sel() || this.edges().some(e => this.touch(e) && (e.from === id || e.to === id)); }
  edgesOf() { return this.edges().filter(e => this.touch(e)); }
}

// ============================================================================================ consumer groups & lag
@Component({
  selector: 'app-kafka-groups', imports: [UI, StatusChipComponent, PageHeaderComponent],
  template: `<div class="page"><app-page-header title="Consumer groups & lag" subtitle="State, partition assignments, committed offsets, log-end offsets and lag, all from the broker (auto-refresh 5 s)"><mat-slide-toggle [(ngModel)]="auto">Auto refresh</mat-slide-toggle></app-page-header>
    @for (g of groups(); track g.groupId) {
      <mat-expansion-panel style="margin-bottom:8px"><mat-expansion-panel-header><mat-panel-title><b class="mono">{{ g.groupId }}</b></mat-panel-title>
        <mat-panel-description><app-status [value]="g.state" /> <span style="margin-left:12px" [class.bad]="g.totalLag > 100" [class.ok]="g.totalLag === 0">lag {{ g.totalLag }}</span> <span class="muted" style="margin-left:12px">{{ g.members.length }} member(s) · {{ g.topics.length }} topic(s)</span></mat-panel-description></mat-expansion-panel-header>
        <div class="muted">coordinator {{ g.coordinator }} · assignor {{ g.partitionAssignor }}</div>
        @for (m of g.members; track m.clientId) { <div class="muted">member <span class="mono">{{ m.clientId }}</span> &#64; {{ m.host }}: {{ m.assignment.join(', ') }}</div> }
        <table class="simple" style="margin-top:8px"><thead><tr><th>Topic</th><th>Partition</th><th>Committed offset</th><th>Log end offset</th><th>Lag</th><th>Owner</th></tr></thead><tbody>
          @for (o of g.offsets; track o.topic + o.partition) {<tr><td class="mono">{{ o.topic }}</td><td>{{ o.partition }}</td><td>{{ o.currentOffset }}</td><td>{{ o.logEndOffset }}</td><td [class.bad]="o.lag > 0"><b>{{ o.lag }}</b></td><td class="mono">{{ o.memberClientId }}</td></tr>}</tbody></table></mat-expansion-panel> }
    @if (!groups().length) { <div class="muted">No consumer groups</div> }</div>`
})
export class KafkaGroupsComponent implements OnInit, OnDestroy {
  private api = inject(MonitoringApi);
  groups = signal<any[]>([]); auto = true; private sub?: Subscription;
  ngOnInit() { this.load(); this.sub = interval(5000).subscribe(() => this.auto && this.load()); }
  ngOnDestroy() { this.sub?.unsubscribe(); }
  load() { this.api.groups().subscribe(g => this.groups.set(g)); }
}

// ============================================================================================ failed + DLT + publish test
@Component({
  selector: 'app-kafka-failed', imports: [UI, PageHeaderComponent, DataTableComponent, StatusChipComponent],
  template: `<div class="page"><app-page-header title="Failed messages & dead-letter topics" subtitle="Failed business-event processing is retried with back-off, then dead-lettered. Replay is a guarded, duplicate-safe re-publish (SUPER_ADMIN)." />
    <mat-tab-group>
      <mat-tab label="Failed processing (audit)"><div style="margin-top:12px"><app-table [cols]="cols" [rows]="rows()" [total]="total()" [page]="page()" [size]="25" [rowClickable]="true" (rowClick)="open($event)" (pageChange)="load($event.pageIndex)">
        <ng-template #actions let-a>@if (auth.can('KAFKA_REPLAY') && (a.status === 'FAILED' || a.status === 'DEAD_LETTERED')) { <button mat-stroked-button color="warn" (click)="replay(a)">Replay</button> }</ng-template></app-table></div></mat-tab>
      <mat-tab label="Dead-letter topics"><div style="margin-top:12px"><table class="simple"><thead><tr><th>DLT topic</th><th>Messages</th><th>Status</th><th>Source topic producers → consumers</th></tr></thead><tbody>
        @for (t of dlts(); track t.name) {<tr><td class="mono"><b>{{ t.name }}</b></td><td>{{ t.messageCount }}</td><td><app-status [value]="t.status" /></td><td class="muted">{{ t.description }}</td></tr>}</tbody></table>
        <div class="muted" style="margin-top:8px">Open a DLT topic under Kafka → Topics (tick “Show dead-letter topics”) to read its messages. The original record keeps its headers plus the exception that caused dead-lettering.</div></div></mat-tab>
      <mat-tab label="Publish a test event"><div class="card" style="margin-top:12px;max-width:560px"><p class="muted">Only approved topics are allowed (<b>notification.requested</b>). The event goes through the transactional outbox, is audited, consumed by notification-service and shows up in the recipient's notifications.</p>
        <form [formGroup]="f" (ngSubmit)="publish()"><mat-form-field><mat-label>Recipient user id</mat-label><input matInput type="number" formControlName="userId"></mat-form-field><mat-form-field><mat-label>Title</mat-label><input matInput formControlName="title"></mat-form-field>
          <mat-form-field><mat-label>Message</mat-label><input matInput formControlName="message"></mat-form-field><button mat-flat-button color="primary" [disabled]="f.invalid">Publish test event</button></form>
        @if (lastEvent()) { <div class="ok" style="margin-top:8px">Queued event {{ lastEvent() }}: find it in Message history.</div> }</div></mat-tab>
    </mat-tab-group></div>`
})
export class KafkaFailedComponent implements OnInit {
  private api = inject(MonitoringApi); private fb = inject(FormBuilder); private dialog = inject(MatDialog); private snack = inject(MatSnackBar); auth = inject(AuthService);
  rows = signal<any[]>([]); total = signal(0); page = signal(0); dlts = signal<any[]>([]); lastEvent = signal('');
  f = this.fb.nonNullable.group({ userId: [1, Validators.required], title: ['Hello from Kafka monitor', Validators.required], message: ['This is a test notification event', Validators.required] });
  cols: Col[] = [{ key: 'processedAt', label: 'When', type: 'date' }, { key: 'topic', label: 'Topic', type: 'mono' }, { key: 'consumerService', label: 'Consumer' }, { key: 'consumerClass', label: 'Class', type: 'mono' }, { key: 'status', label: 'Status', type: 'chip' }, { key: 'attempts', label: 'Tries' }, { key: 'error', label: 'Error' }, { key: 'replayCount', label: 'Replays' }];
  ngOnInit() { this.load(0); this.api.deadLetters().subscribe(d => this.dlts.set(d)); }
  load(p: number) { this.api.failed({ page: p, size: 25 }).subscribe(r => { this.rows.set(r.content); this.total.set(r.totalElements); this.page.set(r.page); }); }
  open(a: any) { this.api.auditEvent(a.id).subscribe(d => this.dialog.open(AuditDetailDialog, { data: d, maxWidth: '95vw' })); }
  replay(a: any) { this.api.replay(a.id).subscribe({ next: r => { this.snack.open(r.message, 'OK', { duration: 6000 }); this.load(this.page()); } }); }
  publish() { this.api.publishTest(this.f.getRawValue()).subscribe(r => this.lastEvent.set(r.eventId)); }
}
