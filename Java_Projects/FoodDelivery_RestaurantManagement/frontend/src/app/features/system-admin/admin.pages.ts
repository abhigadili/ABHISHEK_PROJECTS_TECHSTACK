import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { DatePipe, KeyValuePipe } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { PageEvent } from '@angular/material/paginator';
import { interval, Subscription } from 'rxjs';
import { AdminApi } from '../../core/services/ops-api';
import { AuthService } from '../../core/auth/auth.service';
import { Coupon, Order, Page } from '../../core/models';
import { UI } from '../../shared/material';
import { MoneyPipe, LabelPipe } from '../../shared/pipes/pipes';
import { PageHeaderComponent, StatusChipComponent, EmptyComponent, StarsComponent } from '../../shared/components/small.components';
import { Col, DataTableComponent } from '../../shared/components/data-table.component';
import { Dialogs } from '../../shared/components/dialogs';

// ============================================================================================ dashboard
@Component({
  selector: 'app-admin-dashboard', imports: [UI, MoneyPipe, DatePipe, KeyValuePipe, PageHeaderComponent, StatusChipComponent],
  template: `<div class="page"><app-page-header title="Platform dashboard" subtitle="Assembled live from every service via WebClient (a failing section degrades alone)"><button mat-stroked-button (click)="load()"><mat-icon>refresh</mat-icon> Refresh</button></app-page-header>
    @if (d(); as d) {
      @if (d.attention) { <div class="card row" style="margin-bottom:16px;background:#fffbeb"><b>Needs attention</b>
        <span class="chip" [class.amber]="d.attention.restaurantsPendingApproval > 0">{{ d.attention.restaurantsPendingApproval ?? '?' }} restaurants pending approval</span>
        <span class="chip" [class.red]="d.attention.failedPayments > 0">{{ d.attention.failedPayments ?? '?' }} failed payments</span>
        <span class="chip" [class.amber]="d.attention.unassignedDeliveries > 0">{{ d.attention.unassignedDeliveries ?? '?' }} unassigned deliveries</span>
        <span class="chip" [class.red]="d.attention.lowStockIngredients > 0">{{ d.attention.lowStockIngredients ?? '?' }} low-stock ingredients</span></div> }
      <div class="grid-sm" style="margin-bottom:16px">
        <div class="card"><div class="stat-label">Users</div><div class="stat">{{ d.users?.total ?? '–' }}</div><div class="muted">{{ d.users?.customer }} customers · {{ d.users?.restaurant_owner }} owners · {{ d.users?.delivery_partner }} partners</div></div>
        <div class="card"><div class="stat-label">Orders (all time)</div><div class="stat">{{ d.orders?.total ?? '–' }}</div><div class="muted">{{ d.orders?.todayPaidOrders }} paid today</div></div>
        <div class="card"><div class="stat-label">Revenue today</div><div class="stat">{{ d.orders?.todayRevenue ?? 0 | money }}</div></div>
        <div class="card"><div class="stat-label">Restaurants approved</div><div class="stat">{{ d.restaurants?.APPROVED ?? '–' }}</div><div class="muted">{{ d.restaurants?.PENDING }} pending</div></div>
        <div class="card"><div class="stat-label">Delivery partners online</div><div class="stat">{{ d.delivery?.online ?? '–' }}</div><div class="muted">{{ d.delivery?.busy }} busy of {{ d.delivery?.partners }}</div></div>
        <div class="card"><div class="stat-label">Payments successful</div><div class="stat">{{ d.payments?.counts?.SUCCESS ?? '–' }}</div><div class="muted">{{ d.payments?.amounts?.SUCCESS | money }}</div></div></div>
      <div class="row" style="align-items:flex-start;gap:16px">
        <div class="card grow" style="min-width:280px"><h3 style="margin-top:0">Orders by status</h3>
          @for (e of d.orders?.byStatus | keyvalue; track e.key) { @if ($any(e.value) > 0) { <div class="row"><app-status [value]="$any(e.key)" /><b class="right">{{ e.value }}</b></div> } }</div>
        <div class="card grow" style="min-width:280px"><h3 style="margin-top:0">Platform activity</h3>
          @for (a of activity(); track a.id) { <div style="margin-bottom:6px"><span class="chip gray">{{ a.category }}</span> {{ a.message }} <span class="muted">{{ a.occurredAt | date: 'HH:mm:ss' }}</span></div> }</div></div>
      <div class="muted" style="margin-top:12px">Generated {{ d.generatedAt | date: 'mediumTime' }}</div>
    } @else { <mat-progress-bar mode="indeterminate" /> }</div>`
})
export class AdminDashboardComponent implements OnInit, OnDestroy {
  private api = inject(AdminApi);
  d = signal<any>(null); activity = signal<any[]>([]); private sub?: Subscription;
  ngOnInit() { this.load(); this.sub = interval(15000).subscribe(() => this.load()); }
  ngOnDestroy() { this.sub?.unsubscribe(); }
  load() { this.api.dashboard().subscribe(d => this.d.set(d)); this.api.activity().subscribe(a => this.activity.set(a.content)); }
}

// ============================================================================================ users
@Component({
  selector: 'app-admin-users', imports: [UI, PageHeaderComponent, DataTableComponent],
  template: `<div class="page"><app-page-header title="User management">@if (auth.can('ADMIN_CREATE')) { <button mat-flat-button color="primary" (click)="adminForm = !adminForm"><mat-icon>person_add</mat-icon> New admin</button> }</app-page-header>
    @if (adminForm) { <div class="card" style="margin-bottom:12px"><form [formGroup]="af" (ngSubmit)="createAdmin()" class="row">
      <mat-form-field style="width:170px"><mat-label>Username</mat-label><input matInput formControlName="username"></mat-form-field><mat-form-field style="width:210px"><mat-label>E-mail</mat-label><input matInput formControlName="email"></mat-form-field>
      <mat-form-field style="width:170px"><mat-label>Full name</mat-label><input matInput formControlName="fullName"></mat-form-field><mat-form-field style="width:170px"><mat-label>Password</mat-label><input matInput type="password" formControlName="password"></mat-form-field>
      <mat-checkbox formControlName="superAdmin">Super admin</mat-checkbox><button mat-flat-button color="primary" [disabled]="af.invalid">Create</button></form></div> }
    <div class="row" style="margin-bottom:8px"><mat-form-field style="width:240px"><mat-label>Search</mat-label><input matInput [(ngModel)]="q" (keyup.enter)="load(0)"></mat-form-field>
      <mat-form-field style="width:200px"><mat-label>Role</mat-label><mat-select [(ngModel)]="role" (selectionChange)="load(0)"><mat-option value="">Any</mat-option>@for (r of roles; track r) {<mat-option [value]="r">{{ r }}</mat-option>}</mat-select></mat-form-field>
      <mat-form-field style="width:160px"><mat-label>Status</mat-label><mat-select [(ngModel)]="status" (selectionChange)="load(0)"><mat-option value="">Any</mat-option><mat-option value="ACTIVE">ACTIVE</mat-option><mat-option value="SUSPENDED">SUSPENDED</mat-option><mat-option value="DEACTIVATED">DEACTIVATED</mat-option></mat-select></mat-form-field></div>
    <app-table [cols]="cols" [rows]="rows()" [total]="total()" [page]="page()" (pageChange)="load($event.pageIndex)">
      <ng-template #actions let-u>@if (u.status === 'ACTIVE') { <button mat-button color="warn" (click)="set(u, 'SUSPENDED')">Suspend</button> } @else { <button mat-button (click)="set(u, 'ACTIVE')">Activate</button> }</ng-template></app-table></div>`
})
export class AdminUsersComponent implements OnInit {
  private api = inject(AdminApi); private fb = inject(FormBuilder); private snack = inject(MatSnackBar); auth = inject(AuthService);
  rows = signal<any[]>([]); total = signal(0); page = signal(0); q = ''; role = ''; status = ''; adminForm = false;
  roles = ['CUSTOMER', 'RESTAURANT_OWNER', 'DELIVERY_PARTNER', 'ADMIN', 'SUPER_ADMIN'];
  cols: Col[] = [{ key: 'id', label: 'ID' }, { key: 'username', label: 'Username' }, { key: 'fullName', label: 'Name' }, { key: 'email', label: 'E-mail' }, { key: 'roles', label: 'Roles' }, { key: 'status', label: 'Status', type: 'chip' }, { key: 'lastLoginAt', label: 'Last login', type: 'ago' }];
  af = this.fb.nonNullable.group({ username: ['', Validators.required], email: ['', [Validators.required, Validators.email]], fullName: ['', Validators.required], password: ['', Validators.required], superAdmin: [false] });
  ngOnInit() { this.load(0); }
  load(p: number) { this.api.users({ q: this.q, role: this.role, status: this.status, page: p, size: 20 }).subscribe(r => { this.rows.set(r.content.map(u => ({ ...u, roles: u.roles.join(', ') }))); this.total.set(r.totalElements); this.page.set(r.page); }); }
  set(u: any, s: string) { this.api.setUserStatus(u.id, s).subscribe(() => this.load(this.page())); }
  createAdmin() { this.api.createAdmin(this.af.getRawValue()).subscribe(() => { this.snack.open('Admin created', undefined, { duration: 2500 }); this.adminForm = false; this.load(0); }); }
}

// ============================================================================================ restaurants (approvals)
@Component({
  selector: 'app-admin-restaurants', imports: [UI, PageHeaderComponent, DataTableComponent],
  template: `<div class="page"><app-page-header title="Restaurants" subtitle="Approve, reject, suspend or deactivate. Approval publishes restaurant.approved and the restaurant becomes searchable." />
    <mat-button-toggle-group [(ngModel)]="status" (change)="load(0)" style="margin-bottom:12px"><mat-button-toggle value="PENDING">Pending</mat-button-toggle><mat-button-toggle value="APPROVED">Approved</mat-button-toggle>
      <mat-button-toggle value="SUSPENDED">Suspended</mat-button-toggle><mat-button-toggle value="REJECTED">Rejected</mat-button-toggle><mat-button-toggle value="DEACTIVATED">Deactivated</mat-button-toggle><mat-button-toggle value="">All</mat-button-toggle></mat-button-toggle-group>
    <app-table [cols]="cols" [rows]="rows()" [total]="total()" [page]="page()" (pageChange)="load($event.pageIndex)">
      <ng-template #actions let-r>
        @if (r.status === 'PENDING' || r.status === 'REJECTED') { <button mat-button color="primary" (click)="act(r, 'approve')" [disabled]="!auth.can('RESTAURANT_APPROVE')">Approve</button> }
        @if (r.status === 'PENDING') { <button mat-button color="warn" (click)="act(r, 'reject', true)">Reject</button> }
        @if (r.status === 'APPROVED') { <button mat-button color="warn" (click)="act(r, 'suspend', true)">Suspend</button><button mat-button (click)="act(r, 'deactivate', true)">Deactivate</button> }
        @if (r.status === 'SUSPENDED' || r.status === 'DEACTIVATED') { <button mat-button color="primary" (click)="act(r, 'reactivate')">Reactivate</button> }</ng-template></app-table></div>`
})
export class AdminRestaurantsComponent implements OnInit {
  private api = inject(AdminApi); private dlg = inject(Dialogs); auth = inject(AuthService);
  rows = signal<any[]>([]); total = signal(0); page = signal(0); status = 'PENDING';
  cols: Col[] = [{ key: 'id', label: 'ID' }, { key: 'name', label: 'Name' }, { key: 'city', label: 'City' }, { key: 'cuisines', label: 'Cuisines' }, { key: 'status', label: 'Status', type: 'chip' }, { key: 'avgRating', label: 'Rating' }, { key: 'statusReason', label: 'Note' }];
  ngOnInit() { this.load(0); }
  load(p: number) { this.api.restaurants({ status: this.status, page: p, size: 20 }).subscribe(r => { this.rows.set(r.content.map(x => ({ ...x, cuisines: x.cuisines.join(', ') }))); this.total.set(r.totalElements); this.page.set(r.page); }); }
  act(r: any, a: 'approve' | 'reject' | 'suspend' | 'deactivate' | 'reactivate', reason = false) {
    const go = (why?: string) => this.api.restaurantAction(r.id, a, why).subscribe(() => this.load(this.page()));
    if (reason) this.dlg.confirm(`${a[0].toUpperCase() + a.slice(1)} ${r.name}?`, 'The owner will be notified.', { danger: true, reasonLabel: 'Reason' }).subscribe(x => x && go(x.reason)); else go();
  }
}

// ============================================================================================ orders
@Component({
  selector: 'app-order-view-dialog', imports: [UI, MoneyPipe, DatePipe, StatusChipComponent],
  template: `<h2 mat-dialog-title>{{ o.orderNumber }} <app-status [value]="o.status" /></h2><mat-dialog-content style="min-width:min(560px,85vw)">
    <div class="muted">{{ o.customerName }} → {{ o.restaurantName }} · {{ o.totalAmount | money }} · {{ o.paymentMethod }}</div><div class="muted">Deliver to {{ o.deliveryAddress }}</div>
    @for (i of o.items; track $index) { <div>{{ i.quantity }} × {{ i.name }} <span class="right muted">{{ i.lineTotal | money }}</span></div> }
    <h3>Status history</h3>@for (h of o.history; track $index) { <div><app-status [value]="h.to" /> <span class="muted">{{ h.at | date: 'HH:mm:ss' }} · {{ h.actor }} {{ h.reason ? '· ' + h.reason : '' }}</span></div> }</mat-dialog-content>
    <mat-dialog-actions align="end"><button mat-button mat-dialog-close>Close</button></mat-dialog-actions>`
})
export class OrderViewDialog { o = inject<Order>(MAT_DIALOG_DATA); }

@Component({
  selector: 'app-admin-orders', imports: [UI, PageHeaderComponent, DataTableComponent],
  template: `<div class="page"><app-page-header title="Order monitoring" />
    <div class="row" style="margin-bottom:8px"><mat-form-field style="width:240px"><mat-label>Order #, customer, restaurant</mat-label><input matInput [(ngModel)]="q" (keyup.enter)="load(0)"></mat-form-field>
      <mat-form-field style="width:220px"><mat-label>Status</mat-label><mat-select [(ngModel)]="status" (selectionChange)="load(0)"><mat-option value="">Any</mat-option>@for (s of statuses; track s) {<mat-option [value]="s">{{ s }}</mat-option>}</mat-select></mat-form-field><button mat-stroked-button (click)="load(0)">Search</button></div>
    <app-table [cols]="cols" [rows]="rows()" [total]="total()" [page]="page()" [rowClickable]="true" (rowClick)="view($event)" (pageChange)="load($event.pageIndex)" /></div>`
})
export class AdminOrdersComponent implements OnInit {
  private api = inject(AdminApi); private dialog = inject(MatDialog);
  rows = signal<any[]>([]); total = signal(0); page = signal(0); q = ''; status = '';
  statuses = ['PAYMENT_PENDING', 'CONFIRMED', 'RESTAURANT_ACCEPTED', 'PREPARING', 'READY_FOR_PICKUP', 'PICKED_UP', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED', 'REJECTED', 'PAYMENT_FAILED', 'REFUND_PENDING', 'REFUNDED'];
  cols: Col[] = [{ key: 'orderNumber', label: 'Order', type: 'mono' }, { key: 'customerName', label: 'Customer' }, { key: 'restaurantName', label: 'Restaurant' }, { key: 'status', label: 'Status', type: 'chip' }, { key: 'totalAmount', label: 'Total', type: 'money' }, { key: 'createdAt', label: 'Placed', type: 'date' }];
  ngOnInit() { this.load(0); }
  load(p: number) { this.api.orders({ q: this.q, status: this.status, page: p, size: 20 }).subscribe(r => { this.rows.set(r.content); this.total.set(r.totalElements); this.page.set(r.page); }); }
  view(o: any) { this.api.order(o.id).subscribe(d => this.dialog.open(OrderViewDialog, { data: d, maxWidth: '95vw' })); }
}

// ============================================================================================ payments & refunds
@Component({
  selector: 'app-admin-payments', imports: [UI, PageHeaderComponent, DataTableComponent],
  template: `<div class="page"><app-page-header title="Payment monitoring" subtitle="Provider SANDBOX: no real money moves" />
    <div class="row" style="margin-bottom:8px"><mat-form-field style="width:220px"><mat-label>Order number</mat-label><input matInput [(ngModel)]="q" (keyup.enter)="load(0)"></mat-form-field>
      <mat-form-field style="width:180px"><mat-label>Status</mat-label><mat-select [(ngModel)]="status" (selectionChange)="load(0)"><mat-option value="">Any</mat-option>@for (s of ['PENDING','SUCCESS','FAILED','CANCELLED','REFUNDED']; track s) {<mat-option [value]="s">{{ s }}</mat-option>}</mat-select></mat-form-field></div>
    <app-table [cols]="cols" [rows]="rows()" [total]="total()" [page]="page()" (pageChange)="load($event.pageIndex)" /></div>`
})
export class AdminPaymentsComponent implements OnInit {
  private api = inject(AdminApi);
  rows = signal<any[]>([]); total = signal(0); page = signal(0); q = ''; status = '';
  cols: Col[] = [{ key: 'orderNumber', label: 'Order', type: 'mono' }, { key: 'amount', label: 'Amount', type: 'money' }, { key: 'method', label: 'Method' }, { key: 'status', label: 'Status', type: 'chip' }, { key: 'provider', label: 'Provider' }, { key: 'sandbox', label: 'Sandbox', type: 'bool' }, { key: 'transactionRef', label: 'Reference', type: 'mono' }, { key: 'failureReason', label: 'Failure' }, { key: 'createdAt', label: 'Created', type: 'date' }];
  ngOnInit() { this.load(0); }
  load(p: number) { this.api.payments({ q: this.q, status: this.status, page: p, size: 20 }).subscribe(r => { this.rows.set(r.content); this.total.set(r.totalElements); this.page.set(r.page); }); }
}

@Component({
  selector: 'app-admin-refunds', imports: [UI, PageHeaderComponent, DataTableComponent],
  template: `<div class="page"><app-page-header title="Refund monitoring" subtitle="Failed refunds keep the order in REFUND_PENDING until someone retries them" />
    <mat-button-toggle-group [(ngModel)]="status" (change)="load(0)" style="margin-bottom:12px"><mat-button-toggle value="">All</mat-button-toggle><mat-button-toggle value="INITIATED">Initiated</mat-button-toggle><mat-button-toggle value="COMPLETED">Completed</mat-button-toggle><mat-button-toggle value="FAILED">Failed</mat-button-toggle></mat-button-toggle-group>
    <app-table [cols]="cols" [rows]="rows()" [total]="total()" [page]="page()" (pageChange)="load($event.pageIndex)"><ng-template #actions let-r>@if (r.status === 'FAILED') { <button mat-flat-button color="primary" (click)="retry(r)" [disabled]="!auth.can('REFUND_MANAGE')">Retry</button> }</ng-template></app-table></div>`
})
export class AdminRefundsComponent implements OnInit {
  private api = inject(AdminApi); auth = inject(AuthService);
  rows = signal<any[]>([]); total = signal(0); page = signal(0); status = '';
  cols: Col[] = [{ key: 'id', label: 'ID' }, { key: 'orderId', label: 'Order id' }, { key: 'amount', label: 'Amount', type: 'money' }, { key: 'status', label: 'Status', type: 'chip' }, { key: 'attempts', label: 'Attempts' }, { key: 'reason', label: 'Reason' }, { key: 'failureReason', label: 'Failure' }, { key: 'createdAt', label: 'Created', type: 'date' }];
  ngOnInit() { this.load(0); }
  load(p: number) { this.api.refunds({ status: this.status, page: p, size: 20 }).subscribe(r => { this.rows.set(r.content); this.total.set(r.totalElements); this.page.set(r.page); }); }
  retry(r: any) { this.api.retryRefund(r.id).subscribe(() => this.load(this.page())); }
}

// ============================================================================================ delivery
@Component({
  selector: 'app-admin-delivery', imports: [UI, DatePipe, PageHeaderComponent, DataTableComponent],
  template: `<div class="page"><app-page-header title="Delivery monitoring" />
    <mat-tab-group>
      <mat-tab label="Deliveries"><div style="margin-top:12px"><mat-button-toggle-group [(ngModel)]="status" (change)="load(0)" style="margin-bottom:12px"><mat-button-toggle value="">All</mat-button-toggle>@for (s of ['UNASSIGNED','ASSIGNED','ACCEPTED','PICKED_UP','DELIVERED']; track s) {<mat-button-toggle [value]="s">{{ s }}</mat-button-toggle>}</mat-button-toggle-group>
        <app-table [cols]="cols" [rows]="rows()" [total]="total()" [page]="page()" [rowClickable]="true" (rowClick)="trail($event)" (pageChange)="load($event.pageIndex)" />
        @if (trailRows().length) { <h3>Assignment trail</h3>@for (t of trailRows(); track $index) { <div><span class="chip gray">{{ t.action }}</span> partner {{ t.partnerUserId ?? '–' }} <span class="muted">{{ t.at | date: 'HH:mm:ss' }} {{ t.note }}</span></div> } }</div></mat-tab>
      <mat-tab label="Partners"><div style="margin-top:12px"><app-table [cols]="pcols" [rows]="partners()"><ng-template #actions let-p><button mat-button [color]="p.suspended ? 'primary' : 'warn'" (click)="suspend(p)">{{ p.suspended ? 'Reinstate' : 'Suspend' }}</button></ng-template></app-table></div></mat-tab>
    </mat-tab-group></div>`
})
export class AdminDeliveryComponent implements OnInit {
  private api = inject(AdminApi);
  rows = signal<any[]>([]); total = signal(0); page = signal(0); status = ''; partners = signal<any[]>([]); trailRows = signal<any[]>([]);
  cols: Col[] = [{ key: 'orderNumber', label: 'Order', type: 'mono' }, { key: 'status', label: 'Status', type: 'chip' }, { key: 'partnerUserId', label: 'Partner' }, { key: 'pickupAddress', label: 'Pickup' }, { key: 'deliveryAddress', label: 'Delivery' }, { key: 'offerCount', label: 'Offers' }, { key: 'deliveredAt', label: 'Delivered', type: 'date' }];
  pcols: Col[] = [{ key: 'userId', label: 'User id' }, { key: 'fullName', label: 'Name' }, { key: 'vehicleType', label: 'Vehicle' }, { key: 'availability', label: 'State', type: 'chip' }, { key: 'completedDeliveries', label: 'Completed' }, { key: 'rejectedOffers', label: 'Rejected' }, { key: 'ratingAvg', label: 'Rating' }];
  ngOnInit() { this.load(0); this.loadPartners(); }
  load(p: number) { this.api.deliveries({ status: this.status, page: p, size: 20 }).subscribe(r => { this.rows.set(r.content); this.total.set(r.totalElements); this.page.set(r.page); }); }
  loadPartners() { this.api.partners().subscribe(p => this.partners.set(p)); }
  trail(d: any) { this.api.trail(d.id).subscribe(t => this.trailRows.set(t)); }
  suspend(p: any) { this.api.suspendPartner(p.userId, !p.suspended).subscribe(() => this.loadPartners()); }
}

// ============================================================================================ coupons
@Component({
  selector: 'app-admin-coupons', imports: [UI, DatePipe, PageHeaderComponent, DataTableComponent],
  template: `<div class="page"><app-page-header title="Coupons & promotions" subtitle="Coupons are validated by the backend only"><button mat-flat-button color="primary" (click)="form = !form"><mat-icon>add</mat-icon> New coupon</button></app-page-header>
    @if (form) { <div class="card" style="margin-bottom:16px"><form [formGroup]="f" (ngSubmit)="create()"><div class="form-grid">
      <mat-form-field><mat-label>Code</mat-label><input matInput formControlName="code"></mat-form-field><mat-form-field><mat-label>Description</mat-label><input matInput formControlName="description"></mat-form-field>
      <mat-form-field><mat-label>Type</mat-label><mat-select formControlName="discountType"><mat-option value="PERCENTAGE">Percentage</mat-option><mat-option value="FIXED_AMOUNT">Fixed amount</mat-option></mat-select></mat-form-field>
      <mat-form-field><mat-label>Value</mat-label><input matInput type="number" formControlName="discountValue"></mat-form-field><mat-form-field><mat-label>Minimum order</mat-label><input matInput type="number" formControlName="minOrderValue"></mat-form-field>
      <mat-form-field><mat-label>Maximum discount</mat-label><input matInput type="number" formControlName="maxDiscount"></mat-form-field>
      <mat-form-field><mat-label>Valid from</mat-label><input matInput type="datetime-local" formControlName="validFrom"></mat-form-field><mat-form-field><mat-label>Valid to</mat-label><input matInput type="datetime-local" formControlName="validTo"></mat-form-field>
      <mat-form-field><mat-label>Total usage limit</mat-label><input matInput type="number" formControlName="totalUsageLimit"></mat-form-field><mat-form-field><mat-label>Per-user limit</mat-label><input matInput type="number" formControlName="perUserLimit"></mat-form-field>
      <mat-form-field><mat-label>Restaurant id (optional)</mat-label><input matInput type="number" formControlName="restaurantId"></mat-form-field><mat-form-field><mat-label>Only for user id (optional)</mat-label><input matInput type="number" formControlName="eligibleUserId"></mat-form-field></div>
      <button mat-flat-button color="primary" [disabled]="f.invalid">Create coupon</button></form></div> }
    <mat-tab-group><mat-tab label="Coupons"><div style="margin-top:12px"><app-table [cols]="cols" [rows]="rows()" [total]="total()" [page]="page()" [rowClickable]="true" (rowClick)="redemptions($event)" (pageChange)="load($event.pageIndex)">
      <ng-template #actions let-c><mat-slide-toggle [checked]="c.active" (change)="toggle(c, $event.checked)" [disabled]="!auth.can('COUPON_MANAGE')">Active</mat-slide-toggle></ng-template></app-table>
      @if (redeemRows().length) { <h3>Redemption history</h3>@for (r of redeemRows(); track r.id) { <div>order {{ r.orderId }} · customer {{ r.customerId }} · saved {{ r.discountAmount }} <span class="muted">{{ r.redeemedAt | date: 'medium' }}</span></div> } }</div></mat-tab>
      <mat-tab label="Campaigns"><div class="card" style="margin-top:12px"><form [formGroup]="cf" (ngSubmit)="addCampaign()" class="row"><mat-form-field style="width:200px"><mat-label>Name</mat-label><input matInput formControlName="name"></mat-form-field>
        <mat-form-field style="width:260px"><mat-label>Banner text</mat-label><input matInput formControlName="bannerText"></mat-form-field><mat-form-field style="width:200px"><mat-label>Starts</mat-label><input matInput type="datetime-local" formControlName="startsAt"></mat-form-field>
        <mat-form-field style="width:200px"><mat-label>Ends</mat-label><input matInput type="datetime-local" formControlName="endsAt"></mat-form-field><button mat-flat-button color="primary" [disabled]="cf.invalid">Add campaign</button></form></div>
        <div class="grid" style="margin-top:12px">@for (c of campaigns(); track c.id) {<div class="card"><b>{{ c.name }}</b><div class="muted">{{ c.bannerText }}</div><div class="muted">{{ c.startsAt | date: 'mediumDate' }} – {{ c.endsAt | date: 'mediumDate' }}</div></div>}</div></mat-tab></mat-tab-group></div>`
})
export class AdminCouponsComponent implements OnInit {
  private api = inject(AdminApi); private fb = inject(FormBuilder); auth = inject(AuthService);
  rows = signal<Coupon[]>([]); total = signal(0); page = signal(0); form = false; redeemRows = signal<any[]>([]); campaigns = signal<any[]>([]);
  cols: Col[] = [{ key: 'code', label: 'Code', type: 'mono' }, { key: 'discountType', label: 'Type' }, { key: 'discountValue', label: 'Value' }, { key: 'minOrderValue', label: 'Min order', type: 'money' }, { key: 'maxDiscount', label: 'Max' }, { key: 'usedCount', label: 'Used' }, { key: 'totalUsageLimit', label: 'Limit' }, { key: 'validTo', label: 'Expires', type: 'date' }, { key: 'active', label: 'Active', type: 'bool' }];
  f = this.fb.group({ code: ['', Validators.required], description: [''], discountType: ['PERCENTAGE', Validators.required], discountValue: [10, Validators.required], minOrderValue: [0], maxDiscount: [null as number | null],
    validFrom: [this.local(0), Validators.required], validTo: [this.local(30), Validators.required], totalUsageLimit: [null as number | null], perUserLimit: [null as number | null], restaurantId: [null as number | null], eligibleUserId: [null as number | null] });
  cf = this.fb.nonNullable.group({ name: ['', Validators.required], bannerText: [''], startsAt: [this.local(0), Validators.required], endsAt: [this.local(30), Validators.required] });
  private local(days: number) { const d = new Date(Date.now() + days * 864e5); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); }
  ngOnInit() { this.load(0); this.api.campaigns().subscribe(c => this.campaigns.set(c)); }
  load(p: number) { this.api.coupons(p).subscribe(r => { this.rows.set(r.content); this.total.set(r.totalElements); this.page.set(r.page); }); }
  create() { const v = this.f.getRawValue(); this.api.createCoupon({ ...v, validFrom: new Date(v.validFrom!).toISOString(), validTo: new Date(v.validTo!).toISOString() }).subscribe(() => { this.form = false; this.load(0); }); }
  toggle(c: Coupon, a: boolean) { this.api.couponActive(c.id, a).subscribe(() => this.load(this.page())); }
  redemptions(c: Coupon) { this.api.redemptions(c.id).subscribe(p => this.redeemRows.set(p.content)); }
  addCampaign() { const v = this.cf.getRawValue(); this.api.createCampaign({ ...v, active: true, startsAt: new Date(v.startsAt).toISOString(), endsAt: new Date(v.endsAt).toISOString() }).subscribe(() => this.api.campaigns().subscribe(c => this.campaigns.set(c))); }
}

// ============================================================================================ review moderation, inventory overview, system
@Component({
  selector: 'app-admin-reviews', imports: [UI, DatePipe, PageHeaderComponent, StarsComponent, StatusChipComponent, EmptyComponent],
  template: `<div class="page"><app-page-header title="Review moderation" subtitle="Hiding a review recalculates rating aggregates and publishes them" />
    <mat-button-toggle-group [(ngModel)]="status" (change)="load(0)" style="margin-bottom:12px"><mat-button-toggle value="">All</mat-button-toggle><mat-button-toggle value="VISIBLE">Visible</mat-button-toggle><mat-button-toggle value="HIDDEN">Hidden</mat-button-toggle></mat-button-toggle-group>
    @for (r of list(); track r.id) { <div class="card" style="margin-bottom:8px"><div class="row"><b>{{ r.reviewerName }}</b><app-stars [value]="r.restaurantRating" /><app-status [value]="r.status" /><span class="muted">restaurant {{ r.restaurantId }} · order {{ r.orderId }} · {{ r.createdAt | date: 'medium' }}</span>
      <span class="right">@if (r.status === 'VISIBLE') { <button mat-stroked-button color="warn" (click)="hide(r)" [disabled]="!auth.can('REVIEW_MODERATE')">Hide</button> } @else { <button mat-stroked-button (click)="restore(r)">Restore</button> }</span></div>
      <div>{{ r.comment }}</div>@if (r.moderationNote) { <div class="warn muted">Moderation: {{ r.moderationNote }}</div> }</div> }
    @if (!list().length) { <app-empty icon="rate_review" text="No reviews" /> }
    <mat-paginator [length]="total()" [pageSize]="20" [pageIndex]="page()" [hidePageSize]="true" (page)="load($event.pageIndex)" /></div>`
})
export class AdminReviewsComponent implements OnInit {
  private api = inject(AdminApi); private dlg = inject(Dialogs); auth = inject(AuthService);
  list = signal<any[]>([]); total = signal(0); page = signal(0); status = '';
  ngOnInit() { this.load(0); }
  load(p: number) { this.api.reviews({ status: this.status, page: p, size: 20 }).subscribe(r => { this.list.set(r.content); this.total.set(r.totalElements); this.page.set(r.page); }); }
  hide(r: any) { this.dlg.confirm('Hide this review?', 'It disappears from the restaurant page.', { danger: true, reasonLabel: 'Moderation note' }).subscribe(x => x && this.api.hideReview(r.id, x.reason).subscribe(() => this.load(this.page()))); }
  restore(r: any) { this.api.restoreReview(r.id).subscribe(() => this.load(this.page())); }
}

@Component({
  selector: 'app-admin-inventory', imports: [UI, PageHeaderComponent, EmptyComponent],
  template: `<div class="page"><app-page-header title="Inventory overview" subtitle="Across all restaurants (from inventory-service)" />
    @if (d(); as d) { <div class="grid-sm" style="margin-bottom:16px"><div class="card"><div class="stat-label">Tracked ingredients</div><div class="stat">{{ d.ingredients }}</div></div><div class="card"><div class="stat-label">Low stock</div><div class="stat" [class.bad]="d.lowStock > 0">{{ d.lowStock }}</div></div></div>
      <table class="simple"><thead><tr><th>Restaurant</th><th>Ingredient</th><th>Stock</th><th>Alert level</th></tr></thead><tbody>@for (i of d.lowStockItems; track i.id) {<tr><td>#{{ i.restaurantId }}</td><td>{{ i.name }}</td><td class="bad"><b>{{ i.quantity }}</b> {{ i.unit }}</td><td>{{ i.lowStockThreshold }}</td></tr>}</tbody></table>
      @if (!d.lowStockItems.length) { <app-empty icon="check_circle" text="Nothing is running low" /> } }</div>`
})
export class AdminInventoryComponent implements OnInit { private api = inject(AdminApi); d = signal<any>(null); ngOnInit() { this.api.inventoryOverview().subscribe(d => this.d.set(d)); } }

@Component({
  selector: 'app-admin-system', imports: [UI, DatePipe, PageHeaderComponent, DataTableComponent],
  template: `<div class="page"><app-page-header title="System configuration & activity" />
    <mat-tab-group><mat-tab label="Configuration"><div style="margin-top:12px">@for (c of config(); track c.key) { <div class="card row" style="margin-bottom:8px"><div style="width:280px"><b class="mono">{{ c.key }}</b><div class="muted">{{ c.description }}</div></div>
      <mat-form-field class="grow"><mat-label>Value</mat-label><input matInput [(ngModel)]="values[c.key]" [disabled]="!auth.can('SYSTEM_CONFIG')"></mat-form-field>
      <button mat-flat-button color="primary" (click)="save(c.key)" [disabled]="!auth.can('SYSTEM_CONFIG')">Save</button><span class="muted">by {{ c.updatedBy }}, {{ c.updatedAt | date: 'short' }}</span></div> }
      @if (!auth.can('SYSTEM_CONFIG')) { <div class="muted">Only SUPER_ADMIN may change configuration.</div> }</div></mat-tab>
      <mat-tab label="Application activity"><div style="margin-top:12px">@for (a of activity(); track a.id) { <div style="margin-bottom:6px"><span class="chip gray">{{ a.category }}</span> {{ a.message }} <span class="muted">{{ a.occurredAt | date: 'dd MMM HH:mm:ss' }} {{ a.actor }}</span></div> }</div></mat-tab>
      <mat-tab label="Notification history"><div style="margin-top:12px"><app-table [cols]="ncols" [rows]="notes()" /></div></mat-tab></mat-tab-group></div>`
})
export class AdminSystemComponent implements OnInit {
  private api = inject(AdminApi); auth = inject(AuthService); private snack = inject(MatSnackBar);
  config = signal<any[]>([]); activity = signal<any[]>([]); notes = signal<any[]>([]); values: Record<string, string> = {};
  ncols: Col[] = [{ key: 'createdAt', label: 'When', type: 'date' }, { key: 'type', label: 'Type' }, { key: 'channel', label: 'Channel' }, { key: 'status', label: 'Status', type: 'chip' }, { key: 'title', label: 'Title' }];
  ngOnInit() {
    this.api.config().subscribe(c => { this.config.set(c); c.forEach(x => (this.values[x.key] = x.value)); });
    this.api.activity().subscribe(a => this.activity.set(a.content)); this.api.notificationHistory().subscribe(n => this.notes.set(n.content));
  }
  save(k: string) { this.api.setConfig(k, this.values[k]).subscribe(() => this.snack.open('Saved', undefined, { duration: 2000 })); }
}
