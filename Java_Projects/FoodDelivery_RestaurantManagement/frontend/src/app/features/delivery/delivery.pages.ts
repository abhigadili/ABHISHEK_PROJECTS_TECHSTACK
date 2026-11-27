import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { MatSnackBar } from '@angular/material/snack-bar';
import { interval, Subscription } from 'rxjs';
import { DeliveryApi } from '../../core/services/ops-api';
import { Delivery, Partner } from '../../core/models';
import { UI } from '../../shared/material';
import { EmptyComponent, PageHeaderComponent, StatusChipComponent, StarsComponent } from '../../shared/components/small.components';
import { Dialogs } from '../../shared/components/dialogs';

@Component({
  selector: 'app-delivery-dashboard', imports: [UI, DatePipe, PageHeaderComponent, StatusChipComponent, EmptyComponent],
  template: `<div class="page"><app-page-header title="My deliveries" subtitle="Live: refreshes every 4 s">
      @if (me(); as m) { <app-status [value]="m.availability" /><mat-slide-toggle [checked]="m.online" [disabled]="m.suspended" (change)="online($event.checked)">Online</mat-slide-toggle> }</app-page-header>
    @for (d of current(); track d.id) {
      <div class="card" style="margin-bottom:12px"><div class="row"><b>Order {{ d.orderNumber }}</b><app-status [value]="d.status" />
          @if (d.status === 'ASSIGNED' && d.offerExpiresAt) { <span class="warn">Offer expires {{ d.offerExpiresAt | date: 'HH:mm:ss' }}</span> }</div>
        <div style="margin-top:8px"><mat-icon style="vertical-align:middle">storefront</mat-icon> <b>Pickup:</b> {{ d.pickupAddress }}</div>
        <div><mat-icon style="vertical-align:middle">home</mat-icon> <b>Deliver to:</b> {{ d.deliveryAddress }} <span class="muted">({{ d.customerName }})</span></div>
        <div class="row" style="margin-top:12px">
          @if (d.status === 'ASSIGNED') { <button mat-flat-button color="primary" (click)="act(d, 'accept')">Accept</button><button mat-stroked-button color="warn" (click)="reject(d)">Reject</button> }
          @if (d.status === 'ACCEPTED') { <button mat-flat-button color="primary" (click)="act(d, 'pickup')">I picked up the food</button> }
          @if (d.status === 'PICKED_UP') { <button mat-flat-button color="primary" (click)="act(d, 'complete')">Delivered to customer</button> }</div></div> }
    @if (!current().length) { <app-empty icon="delivery_dining" [text]="me()?.online ? 'Waiting for an assignment…' : 'You are offline: go online to receive deliveries'" /> }</div>`
})
export class DeliveryDashboardComponent implements OnInit, OnDestroy {
  private api = inject(DeliveryApi); private dlg = inject(Dialogs); private snack = inject(MatSnackBar);
  me = signal<Partner | null>(null); current = signal<Delivery[]>([]); private sub?: Subscription;
  ngOnInit() { this.load(); this.sub = interval(4000).subscribe(() => this.load()); }
  ngOnDestroy() { this.sub?.unsubscribe(); }
  load() { this.api.me().subscribe(m => this.me.set(m)); this.api.current().subscribe(c => this.current.set(c)); }
  online(on: boolean) { this.api.online(on).subscribe({ next: m => this.me.set(m), error: () => this.load() }); }
  act(d: Delivery, a: 'accept' | 'pickup' | 'complete') { this.api.act(d.id, a).subscribe(() => { this.snack.open('Done', undefined, { duration: 1500 }); this.load(); }); }
  reject(d: Delivery) { this.dlg.confirm('Reject this delivery?', 'It will be offered to another partner.', { danger: true, reasonLabel: 'Reason' }).subscribe(r => r && this.api.act(d.id, 'reject', r.reason).subscribe(() => this.load())); }
}

@Component({
  selector: 'app-delivery-history', imports: [UI, DatePipe, PageHeaderComponent, EmptyComponent],
  template: `<div class="page"><app-page-header title="Delivery history" />
    <table class="simple"><thead><tr><th>Order</th><th>Pickup</th><th>Delivered to</th><th>Delivered at</th></tr></thead><tbody>
      @for (d of list(); track d.id) {<tr><td><b>{{ d.orderNumber }}</b></td><td>{{ d.pickupAddress }}</td><td>{{ d.deliveryAddress }}</td><td>{{ d.deliveredAt | date: 'dd MMM y, HH:mm' }}</td></tr>}</tbody></table>
    @if (!list().length) { <app-empty icon="history" text="No completed deliveries yet" /> }
    <mat-paginator [length]="total()" [pageSize]="20" [pageIndex]="page()" [hidePageSize]="true" (page)="load($event.pageIndex)" /></div>`
})
export class DeliveryHistoryComponent implements OnInit {
  private api = inject(DeliveryApi);
  list = signal<Delivery[]>([]); total = signal(0); page = signal(0);
  ngOnInit() { this.load(0); }
  load(p: number) { this.api.history(p).subscribe(r => { this.list.set(r.content); this.total.set(r.totalElements); this.page.set(r.page); }); }
}

@Component({
  selector: 'app-delivery-profile', imports: [UI, PageHeaderComponent],
  template: `<div class="page"><app-page-header title="Profile & performance" />
    @if (perf(); as p) { <div class="grid-sm" style="margin-bottom:16px">
      <div class="card"><div class="stat-label">Completed</div><div class="stat">{{ p.completed }}</div></div>
      <div class="card"><div class="stat-label">Rating</div><div class="stat">{{ p.rating }} ★</div><div class="muted">{{ p.ratingCount }} ratings</div></div>
      <div class="card"><div class="stat-label">Avg delivery time</div><div class="stat">{{ p.avgDeliveryMinutes ?? '–' }} min</div></div>
      <div class="card"><div class="stat-label">Rejected offers</div><div class="stat">{{ p.rejectedOffers }}</div></div></div> }
    <div class="card"><form [formGroup]="f" (ngSubmit)="save()"><div class="form-grid">
      <mat-form-field><mat-label>Full name</mat-label><input matInput formControlName="fullName"></mat-form-field><mat-form-field><mat-label>Phone</mat-label><input matInput formControlName="phone"></mat-form-field>
      <mat-form-field><mat-label>Vehicle type</mat-label><mat-select formControlName="vehicleType"><mat-option value="BIKE">Bike</mat-option><mat-option value="SCOOTER">Scooter</mat-option><mat-option value="BICYCLE">Bicycle</mat-option><mat-option value="CAR">Car</mat-option></mat-select></mat-form-field>
      <mat-form-field><mat-label>Vehicle number</mat-label><input matInput formControlName="vehicleNumber"></mat-form-field></div>
      <button mat-flat-button color="primary" [disabled]="f.invalid">Save profile</button></form></div></div>`
})
export class DeliveryProfileComponent implements OnInit {
  private api = inject(DeliveryApi); private fb = inject(FormBuilder); private snack = inject(MatSnackBar);
  perf = signal<any>(null);
  f = this.fb.nonNullable.group({ fullName: ['', Validators.required], phone: [''], vehicleType: ['BIKE'], vehicleNumber: [''] });
  ngOnInit() { this.api.me().subscribe(m => this.f.patchValue({ fullName: m.fullName, phone: m.phone ?? '', vehicleType: m.vehicleType ?? 'BIKE', vehicleNumber: m.vehicleNumber ?? '' })); this.api.performance().subscribe(p => this.perf.set(p)); }
  save() { this.api.update(this.f.getRawValue()).subscribe(() => this.snack.open('Profile saved', undefined, { duration: 2000 })); }
}
