import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { DatePipe } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { interval, Subscription } from 'rxjs';
import { CustomerApi } from '../../core/services/customer-api';
import { Address, Cart, Order, OrderSummary, Payment, Refund, SavedMethod } from '../../core/models';
import { UI } from '../../shared/material';
import { MoneyPipe, LabelPipe } from '../../shared/pipes/pipes';
import { EmptyComponent, PageHeaderComponent, StatusChipComponent, StarsComponent } from '../../shared/components/small.components';
import { Dialogs } from '../../shared/components/dialogs';

@Component({
  selector: 'app-cart', imports: [UI, MoneyPipe, PageHeaderComponent, EmptyComponent],
  template: `<div class="page"><app-page-header title="Your cart" [subtitle]="cart()?.restaurantName ?? ''" />
    @if (cart(); as c) {
      @if (!c.lines.length) { <app-empty icon="shopping_cart" text="Your cart is empty"><a mat-flat-button color="primary" routerLink="/customer/restaurants">Browse restaurants</a></app-empty> }
      @else {
        <div class="row" style="align-items:flex-start;gap:20px">
          <div class="grow" style="min-width:300px">
            @for (l of c.lines; track l.id) {
              <div class="card" style="margin-bottom:10px"><div class="row"><div class="grow"><b>{{ l.name }}</b> @if (l.variant) {<span class="chip gray">{{ l.variant }}</span>}
                @for (a of l.addOns; track a) {<span class="chip amber">+ {{ a }}</span>}
                @if (l.instructions) { <div class="muted">“{{ l.instructions }}”</div> }<div class="muted">{{ l.unitPrice | money }} each</div></div>
                <button mat-icon-button (click)="qty(l.id, l.quantity - 1)" [disabled]="l.quantity <= 1"><mat-icon>remove</mat-icon></button><b>{{ l.quantity }}</b><button mat-icon-button (click)="qty(l.id, l.quantity + 1)"><mat-icon>add</mat-icon></button>
                <b style="width:90px;text-align:right">{{ l.lineTotal | money }}</b><button mat-icon-button (click)="remove(l.id)"><mat-icon>delete</mat-icon></button></div></div> }
            <button mat-button color="warn" (click)="clear()">Clear cart</button>
          </div>
          <div class="card" style="width:340px;max-width:100%">
            <h3 style="margin-top:0">Bill (calculated by the server)</h3>
            <div class="row"><span>Subtotal</span><span class="right">{{ c.subtotal | money }}</span></div>
            @if (c.discount > 0) { <div class="row ok"><span>Discount ({{ c.couponCode }})</span><span class="right">− {{ c.discount | money }}</span></div> }
            <div class="row"><span>Delivery fee</span><span class="right">{{ c.deliveryFee | money }}</span></div>
            <div class="row"><span>Taxes (5%)</span><span class="right">{{ c.tax | money }}</span></div>
            <mat-divider style="margin:8px 0" /><div class="row"><b>Total</b><b class="right">{{ c.total | money }}</b></div>
            <div class="row" style="margin-top:12px"><mat-form-field style="flex:1"><mat-label>Coupon code</mat-label><input matInput [(ngModel)]="code" (keyup.enter)="apply()"></mat-form-field>
              @if (c.couponCode) { <button mat-button (click)="dropCoupon()">Remove</button> } @else { <button mat-stroked-button (click)="apply()">Apply</button> }</div>
            @if (c.couponMessage) { <div class="muted" [class.ok]="c.discount > 0" [class.bad]="c.discount === 0">{{ c.couponMessage }}</div> }
            @for (i of c.issues; track i) { <div class="bad muted">⚠ {{ i }}</div> }
            <button mat-flat-button color="primary" class="full" style="margin-top:12px" routerLink="/customer/checkout" [disabled]="!c.orderable">Proceed to checkout</button>
          </div>
        </div>
      }
    }
  </div>`
})
export class CartComponent implements OnInit {
  private api = inject(CustomerApi);
  cart = signal<Cart | null>(null); code = '';
  ngOnInit() { this.api.cart().subscribe(c => this.cart.set(c)); }
  qty(id: number, q: number) { this.api.updateCartItem(id, { quantity: q }).subscribe(c => this.cart.set(c)); }
  remove(id: number) { this.api.removeCartItem(id).subscribe(c => this.cart.set(c)); }
  clear() { this.api.clearCart().subscribe(() => this.api.cart().subscribe(c => this.cart.set(c))); }
  apply() { if (this.code.trim()) this.api.applyCoupon(this.code.trim()).subscribe(c => this.cart.set(c)); }
  dropCoupon() { this.api.removeCoupon().subscribe(c => this.cart.set(c)); }
}

@Component({
  selector: 'app-checkout', imports: [UI, MoneyPipe, PageHeaderComponent, EmptyComponent],
  template: `<div class="page"><app-page-header title="Checkout" />
    @if (cart(); as c) { @if (!c.lines.length) { <app-empty icon="shopping_cart" text="Nothing to check out" /> } @else {
    <div class="row" style="align-items:flex-start;gap:20px">
      <div class="grow" style="min-width:300px">
        <div class="card" style="margin-bottom:12px"><h3 style="margin-top:0">1. Delivery address</h3>
          @if (!addresses().length) { <p>You have no saved address. <a routerLink="/customer/addresses">Add one</a>.</p> }
          <mat-radio-group [(ngModel)]="addressId" style="display:flex;flex-direction:column">@for (a of addresses(); track a.id) {<mat-radio-button [value]="a.id"><b>{{ a.label }}</b> — {{ a.line1 }}, {{ a.city }} {{ a.postalCode }} @if (a.defaultAddress) {<span class="chip green">default</span>}</mat-radio-button>}</mat-radio-group></div>
        <div class="card" style="margin-bottom:12px"><h3 style="margin-top:0">2. Payment method</h3>
          <mat-radio-group [(ngModel)]="method" style="display:flex;flex-direction:column"><mat-radio-button value="CARD">Credit / debit card</mat-radio-button><mat-radio-button value="UPI">UPI</mat-radio-button><mat-radio-button value="WALLET">Wallet</mat-radio-button></mat-radio-group>
          <div class="card" style="background:#fff7ed;margin-top:8px"><b>Sandbox payments:</b> <span class="muted">no real money moves. Pick an outcome to test:</span>
            <mat-radio-group [(ngModel)]="token" style="display:flex;flex-direction:column;margin-top:4px">
              <mat-radio-button value="tok_success">Payment succeeds</mat-radio-button><mat-radio-button value="tok_fail">Payment is declined</mat-radio-button>
              <mat-radio-button value="tok_refund_fail">Succeeds, but a later refund fails</mat-radio-button></mat-radio-group></div>
          @if (saved().length) { <mat-form-field style="margin-top:8px"><mat-label>Or use a saved method</mat-label><mat-select [(ngModel)]="savedId"><mat-option [value]="null">None</mat-option>@for (m of saved(); track m.id) {<mat-option [value]="m.id">{{ m.label }} {{ m.maskedValue }}</mat-option>}</mat-select></mat-form-field> }</div>
        <div class="card"><h3 style="margin-top:0">3. Notes</h3><mat-form-field><mat-label>Special instructions for the order</mat-label><input matInput [(ngModel)]="notes" maxlength="500"></mat-form-field></div>
      </div>
      <div class="card" style="width:340px;max-width:100%"><h3 style="margin-top:0">{{ c.restaurantName }}</h3>
        @for (l of c.lines; track l.id) { <div class="row"><span>{{ l.quantity }} × {{ l.name }}</span><span class="right">{{ l.lineTotal | money }}</span></div> }
        <mat-divider style="margin:8px 0" /><div class="row"><span>Subtotal</span><span class="right">{{ c.subtotal | money }}</span></div>
        @if (c.discount > 0) {<div class="row ok"><span>Discount {{ c.couponCode }}</span><span class="right">− {{ c.discount | money }}</span></div>}
        <div class="row"><span>Delivery + taxes</span><span class="right">{{ c.deliveryFee + c.tax | money }}</span></div>
        <div class="row"><b>Total</b><b class="right">{{ c.total | money }}</b></div>
        <button mat-flat-button color="primary" class="full" style="margin-top:12px" [disabled]="busy() || !addressId || !c.orderable" (click)="place()">{{ busy() ? 'Processing…' : 'Place order & pay' }}</button>
        <div class="muted" style="margin-top:6px">The final price is re-validated by the backend when you place the order.</div></div>
    </div>} }
  </div>`
})
export class CheckoutComponent implements OnInit {
  private api = inject(CustomerApi); private router = inject(Router); private snack = inject(MatSnackBar);
  cart = signal<Cart | null>(null); addresses = signal<Address[]>([]); saved = signal<SavedMethod[]>([]); busy = signal(false);
  addressId: number | null = null; method = 'CARD'; token = 'tok_success'; savedId: number | null = null; notes = '';
  private key = crypto.randomUUID();      // one idempotency key per checkout attempt: a double-click can never create two orders
  ngOnInit() {
    this.api.cart().subscribe(c => this.cart.set(c));
    this.api.addresses().subscribe(a => { this.addresses.set(a); this.addressId = a.find(x => x.defaultAddress)?.id ?? a[0]?.id ?? null; });
    this.api.methods().subscribe(m => this.saved.set(m));
  }
  place() {
    this.busy.set(true);
    this.api.placeOrder({ addressId: this.addressId, couponCode: this.cart()?.couponCode, paymentMethod: this.method, specialInstructions: this.notes || undefined }, this.key).subscribe({
      next: order => this.payWhenReady(order),
      error: () => { this.busy.set(false); this.key = crypto.randomUUID(); }
    });
  }
  /** The payment record is created asynchronously from the order.created event: poll until it exists, then pay. */
  private payWhenReady(order: Order, tries = 0) {
    this.api.payment(order.id).subscribe({
      next: () => this.api.pay(order.id, { method: this.method, paymentToken: this.savedId ? undefined : this.token, savedMethodId: this.savedId ?? undefined }, 'pay-' + this.key).subscribe({
        next: p => { this.snack.open(p.status === 'SUCCESS' ? 'Payment successful (sandbox)' : 'Payment failed: ' + (p.failureReason ?? ''), undefined, { duration: 4000 }); this.router.navigate(['/customer/orders', order.id]); },
        error: () => this.router.navigate(['/customer/orders', order.id])
      }),
      error: () => tries < 20 ? setTimeout(() => this.payWhenReady(order, tries + 1), 750) : this.router.navigate(['/customer/orders', order.id])
    });
  }
}

@Component({
  selector: 'app-orders', imports: [UI, MoneyPipe, DatePipe, StatusChipComponent, PageHeaderComponent, EmptyComponent],
  template: `<div class="page"><app-page-header title="My orders" />
    <div class="row" style="margin-bottom:12px"><mat-form-field style="width:260px"><mat-label>Search order # or restaurant</mat-label><input matInput [(ngModel)]="q" (keyup.enter)="load(0)"></mat-form-field>
      <mat-form-field style="width:200px"><mat-label>Status</mat-label><mat-select [(ngModel)]="status" (selectionChange)="load(0)"><mat-option value="">All</mat-option>
        @for (s of statuses; track s) {<mat-option [value]="s">{{ s }}</mat-option>}</mat-select></mat-form-field><button mat-stroked-button (click)="load(0)">Search</button></div>
    @for (o of orders(); track o.id) {
      <a class="card" [routerLink]="['/customer/orders', o.id]" style="display:flex;gap:16px;align-items:center;margin-bottom:10px;color:inherit;text-decoration:none">
        <div class="grow"><b>{{ o.restaurantName }}</b><div class="muted">{{ o.orderNumber }} · {{ o.createdAt | date: 'dd MMM y, HH:mm' }} · {{ o.itemCount }} items</div></div>
        <app-status [value]="o.status" /><b>{{ o.totalAmount | money }}</b></a> }
    @if (!orders().length) { <app-empty icon="receipt_long" text="No orders yet" /> }
    <mat-paginator [length]="total()" [pageSize]="10" [pageIndex]="page()" [hidePageSize]="true" (page)="load($event.pageIndex)" />
  </div>`
})
export class OrdersComponent implements OnInit {
  private api = inject(CustomerApi);
  orders = signal<OrderSummary[]>([]); total = signal(0); page = signal(0); q = ''; status = '';
  statuses = ['PAYMENT_PENDING', 'CONFIRMED', 'RESTAURANT_ACCEPTED', 'PREPARING', 'READY_FOR_PICKUP', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED', 'REJECTED', 'PAYMENT_FAILED', 'REFUND_PENDING', 'REFUNDED'];
  ngOnInit() { this.load(0); }
  load(p: number) { this.api.myOrders({ q: this.q, status: this.status, page: p, size: 10 }).subscribe(r => { this.orders.set(r.content); this.total.set(r.totalElements); this.page.set(r.page); }); }
}

@Component({
  selector: 'app-review-dialog', imports: [UI, StarsComponent],
  template: `<h2 mat-dialog-title>Rate your order</h2><mat-dialog-content style="min-width:min(380px,80vw)">
    <div class="row">Restaurant <app-stars [value]="rest" [editable]="true" (valueChange)="rest = $event" /></div>
    <div class="row">Delivery <app-stars [value]="del" [editable]="true" (valueChange)="del = $event" /></div>
    @for (i of d.items; track i.menuItemId) { <div class="row">{{ i.name }} <app-stars [value]="item[i.menuItemId] || 0" [editable]="true" (valueChange)="item[i.menuItemId] = $event" /></div> }
    <mat-form-field style="margin-top:8px"><mat-label>Comment</mat-label><textarea matInput [(ngModel)]="comment" maxlength="1000" rows="3"></textarea></mat-form-field></mat-dialog-content>
    <mat-dialog-actions align="end"><button mat-button mat-dialog-close>Cancel</button><button mat-flat-button color="primary" [disabled]="!rest" [mat-dialog-close]="result()">Submit review</button></mat-dialog-actions>`
})
export class ReviewDialog {
  d = inject<{ orderId: number; items: { menuItemId: number; name: string }[] }>(MAT_DIALOG_DATA);
  rest = 5; del = 5; comment = ''; item: Record<number, number> = {};
  result() { return { orderId: this.d.orderId, restaurantRating: this.rest, deliveryRating: this.del || undefined, comment: this.comment || undefined,
    itemRatings: Object.entries(this.item).filter(([, v]) => v > 0).map(([k, v]) => ({ menuItemId: Number(k), rating: v })) }; }
}

const FLOW = ['PAYMENT_PENDING', 'CONFIRMED', 'RESTAURANT_ACCEPTED', 'PREPARING', 'READY_FOR_PICKUP', 'OUT_FOR_DELIVERY', 'DELIVERED'];

@Component({
  selector: 'app-order-detail', imports: [UI, MoneyPipe, DatePipe, StatusChipComponent, LabelPipe],
  template: `<div class="page">
    @if (o(); as o) {
      <div class="row"><div><h1>Order {{ o.orderNumber }}</h1><div class="muted">{{ o.restaurantName }} · placed {{ o.createdAt | date: 'dd MMM y, HH:mm' }}</div></div>
        <span class="right row"><app-status [value]="o.status" />
          @if (o.allowedActions.includes('CANCEL')) { <button mat-stroked-button color="warn" (click)="cancel()">Cancel order</button> }
          @if (canReview()) { <button mat-flat-button color="primary" (click)="review()">Rate this order</button> }</span></div>

      @if (terminal(o.status)) { <div class="card" style="margin:12px 0;background:#fef2f2"><b>{{ o.status | label }}</b> @if (o.cancelReason) { — {{ o.cancelReason }} } </div> }
      @else { <div class="card" style="margin:12px 0"><div class="row" style="justify-content:space-between">
        @for (s of flow; track s; let i = $index) { <div style="text-align:center;flex:1;min-width:80px"><mat-icon [class]="idx(o.status) >= i ? 'ok' : 'muted'">{{ idx(o.status) >= i ? 'check_circle' : 'radio_button_unchecked' }}</mat-icon><div class="muted" style="font-size:11px">{{ s | label }}</div></div> }</div>
        <mat-progress-bar mode="determinate" [value]="(idx(o.status) / (flow.length - 1)) * 100" /></div> }

      @if (payment(); as p) {
        <div class="card" style="margin-bottom:12px"><div class="row"><b>Payment</b><app-status [value]="p.status" />@if (p.sandbox) {<span class="chip amber">SANDBOX — no real money</span>}
          <span class="muted">{{ p.method }} · {{ p.amount | money }} @if (p.transactionRef) { · ref {{ p.transactionRef }} }</span></div>
          @if (p.failureReason) { <div class="bad muted">{{ p.failureReason }}</div> }
          @if (p.status === 'PENDING') { <div class="row" style="margin-top:8px"><button mat-flat-button color="primary" (click)="payNow('tok_success')">Pay now (sandbox success)</button>
            <button mat-stroked-button (click)="payNow('tok_fail')">Simulate decline</button><span class="muted">Expires {{ p.expiresAt | date: 'HH:mm:ss' }}</span></div> }</div> }
      @if (refund(); as r) {
        <div class="card" style="margin-bottom:12px"><div class="row"><b>Refund</b><app-status [value]="r.status" /><span class="muted">{{ r.amount | money }} @if (r.completedAt) { · completed {{ r.completedAt | date: 'dd MMM, HH:mm' }} }</span></div>
          @if (r.failureReason) { <div class="warn muted">{{ r.failureReason }} — our team will retry.</div> }</div> }
      @if (delivery(); as d) { <div class="card" style="margin-bottom:12px"><div class="row"><b>Delivery</b><app-status [value]="d.status" /><span class="muted">{{ d.pickupAddress }} → {{ d.deliveryAddress }}</span></div></div> }

      <div class="row" style="align-items:flex-start;gap:16px">
        <div class="card grow" style="min-width:300px"><h3 style="margin-top:0">Items</h3>
          @for (i of o.items; track $index) { <div class="row"><span>{{ i.quantity }} × {{ i.name }} @if (i.variant) {<span class="chip gray">{{ i.variant }}</span>} @if (i.addOns) {<span class="muted">+ {{ i.addOns }}</span>}</span><span class="right">{{ i.lineTotal | money }}</span></div> }
          <mat-divider style="margin:8px 0" /><div class="row"><span>Subtotal</span><span class="right">{{ o.subtotal | money }}</span></div>
          @if (o.discountAmount > 0) {<div class="row ok"><span>Discount {{ o.couponCode }}</span><span class="right">− {{ o.discountAmount | money }}</span></div>}
          <div class="row"><span>Delivery</span><span class="right">{{ o.deliveryFee | money }}</span></div><div class="row"><span>Tax</span><span class="right">{{ o.taxAmount | money }}</span></div>
          <div class="row"><b>Total</b><b class="right">{{ o.totalAmount | money }}</b></div>
          <div class="muted" style="margin-top:8px">Deliver to: {{ o.deliveryAddress }}</div></div>
        <div class="card grow" style="min-width:300px"><h3 style="margin-top:0">Tracking history</h3>
          @for (h of o.history.slice().reverse(); track $index) { <div style="margin-bottom:8px"><app-status [value]="h.to" /> <span class="muted">{{ h.at | date: 'dd MMM, HH:mm:ss' }} · {{ h.actor }}</span>@if (h.reason) {<div class="muted">{{ h.reason }}</div>}</div> }</div>
      </div>
    }
  </div>`
})
export class OrderDetailComponent implements OnInit, OnDestroy {
  private api = inject(CustomerApi); private route = inject(ActivatedRoute); private dlg = inject(Dialogs); private dialog = inject(MatDialog); private snack = inject(MatSnackBar);
  o = signal<Order | null>(null); payment = signal<Payment | null>(null); refund = signal<Refund | null>(null); delivery = signal<any>(null);
  reviewable = signal(false); flow = FLOW; private sub?: Subscription; private id = 0;
  ngOnInit() { this.id = Number(this.route.snapshot.paramMap.get('id')); this.load(); this.sub = interval(4000).subscribe(() => this.load()); }
  ngOnDestroy() { this.sub?.unsubscribe(); }
  load() {
    this.api.order(this.id).subscribe(o => {
      this.o.set(o);
      this.api.payment(this.id).subscribe({ next: p => this.payment.set(p), error: () => {} });
      if (['CANCELLED', 'REJECTED', 'REFUND_PENDING', 'REFUNDED'].includes(o.status)) this.api.refund(this.id).subscribe({ next: r => this.refund.set(r), error: () => {} });
      if (['READY_FOR_PICKUP', 'PICKED_UP', 'OUT_FOR_DELIVERY', 'DELIVERED'].includes(o.status)) this.api.delivery(this.id).subscribe({ next: d => this.delivery.set(d), error: () => {} });
      if (o.status === 'DELIVERED') this.api.reviewable().subscribe(r => this.reviewable.set(r.some(x => x.orderId === this.id)));
    });
  }
  idx(s: string) { return FLOW.indexOf(s); }
  terminal(s: string) { return ['PAYMENT_FAILED', 'CANCELLED', 'REJECTED', 'REFUND_PENDING', 'REFUNDED'].includes(s); }
  canReview() { return this.reviewable(); }
  cancel() { this.dlg.confirm('Cancel this order?', 'If you already paid, a refund starts automatically.', { confirmText: 'Cancel order', danger: true, reasonLabel: 'Reason (optional)' })
    .subscribe(r => r && this.api.cancelOrder(this.id, r.reason).subscribe(() => this.load())); }
  payNow(token: string) { this.api.pay(this.id, { paymentToken: token }, crypto.randomUUID()).subscribe(() => this.load()); }
  review() {
    this.dialog.open(ReviewDialog, { data: { orderId: this.id, items: this.o()!.items } }).afterClosed().subscribe(b => b && this.api.createReview(b).subscribe(() => { this.snack.open('Thanks for your review!', undefined, { duration: 3000 }); this.reviewable.set(false); }));
  }
}
