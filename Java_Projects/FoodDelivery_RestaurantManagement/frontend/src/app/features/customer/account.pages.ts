import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { CustomerApi } from '../../core/services/customer-api';
import { Address, Notification, SavedMethod } from '../../core/models';
import { UI } from '../../shared/material';
import { EmptyComponent, PageHeaderComponent } from '../../shared/components/small.components';
import { TimeAgoPipe } from '../../shared/pipes/pipes';
import { Dialogs } from '../../shared/components/dialogs';

@Component({
  selector: 'app-profile', imports: [UI, PageHeaderComponent, DatePipe],
  template: `<div class="page"><app-page-header title="My profile" />
    <div class="row" style="align-items:flex-start;gap:20px">
      <div class="card grow" style="min-width:300px"><h3 style="margin-top:0">Details & preferences</h3>
        <form [formGroup]="f" (ngSubmit)="save()">
          <div class="form-grid"><mat-form-field><mat-label>Full name</mat-label><input matInput formControlName="fullName"></mat-form-field>
            <mat-form-field><mat-label>Phone</mat-label><input matInput formControlName="phone"></mat-form-field></div>
          <mat-form-field><mat-label>Favourite cuisines (comma separated)</mat-label><input matInput formControlName="cuisines"></mat-form-field>
          <div><mat-checkbox formControlName="vegetarianOnly">Vegetarian only</mat-checkbox></div>
          <div><mat-checkbox formControlName="notifyInApp">In-app notifications</mat-checkbox> <mat-checkbox formControlName="notifyEmail">E-mail</mat-checkbox> <mat-checkbox formControlName="notifySms">SMS</mat-checkbox></div>
          <button mat-flat-button color="primary" style="margin-top:12px" [disabled]="f.invalid">Save</button></form>
        <div class="row" style="margin-top:16px"><div class="muted">Profile picture (PNG/JPEG/WEBP, max 2 MB)</div><input type="file" accept="image/png,image/jpeg,image/webp" (change)="avatar($event)">
          @if (avatarUrl()) { <img [src]="avatarUrl()" class="dish-img" alt="avatar"> }</div></div>
      <div class="card grow" style="min-width:300px"><h3 style="margin-top:0">Change password</h3>
        <form [formGroup]="pw" (ngSubmit)="change()"><mat-form-field><mat-label>Current password</mat-label><input matInput type="password" formControlName="current"></mat-form-field>
          <mat-form-field><mat-label>New password</mat-label><input matInput type="password" formControlName="next"><mat-hint>8+ chars, upper, lower, digit, symbol</mat-hint></mat-form-field>
          <button mat-flat-button color="primary" style="margin-top:12px" [disabled]="pw.invalid">Change password</button></form>
        <h3>Recent activity</h3>@for (a of activity(); track a.id) {<div class="muted">{{ a.createdAt | date: 'dd MMM, HH:mm' }} — {{ a.detail }}</div>}</div>
    </div></div>`
})
export class ProfileComponent implements OnInit {
  private api = inject(CustomerApi); private fb = inject(FormBuilder); private snack = inject(MatSnackBar); private auth = inject(AuthService);
  avatarUrl = signal<string | undefined>(undefined); activity = signal<any[]>([]);
  f = this.fb.nonNullable.group({ fullName: ['', Validators.required], phone: [''], cuisines: [''], vegetarianOnly: [false], notifyInApp: [true], notifyEmail: [true], notifySms: [true] });
  pw = this.fb.nonNullable.group({ current: ['', Validators.required], next: ['', [Validators.required, Validators.minLength(8)]] });
  ngOnInit() {
    this.api.me().subscribe(m => { this.f.patchValue({ fullName: m.fullName, phone: m.phone ?? '', cuisines: m.preferences.favouriteCuisines ?? '', vegetarianOnly: m.preferences.vegetarianOnly,
      notifyInApp: m.preferences.notifyInApp, notifyEmail: m.preferences.notifyEmail, notifySms: m.preferences.notifySms }); this.avatarUrl.set(m.avatarUrl); });
    this.api.activity().subscribe(p => this.activity.set(p.content));
  }
  save() { const v = this.f.getRawValue(); this.api.updateMe({ fullName: v.fullName, phone: v.phone || null, preferences: { favouriteCuisines: v.cuisines, vegetarianOnly: v.vegetarianOnly, notifyEmail: v.notifyEmail, notifySms: v.notifySms, notifyInApp: v.notifyInApp } })
    .subscribe(() => this.snack.open('Profile saved', undefined, { duration: 2000 })); }
  avatar(e: Event) { const file = (e.target as HTMLInputElement).files?.[0]; if (file) this.api.avatar(file).subscribe(m => { this.avatarUrl.set(m.avatarUrl); this.snack.open('Picture updated', undefined, { duration: 2000 }); }); }
  change() { this.auth.changePassword(this.pw.value.current!, this.pw.value.next!).subscribe(() => { this.snack.open('Password changed', undefined, { duration: 2500 }); this.pw.reset(); }); }
}

@Component({
  selector: 'app-addresses', imports: [UI, PageHeaderComponent, EmptyComponent],
  template: `<div class="page"><app-page-header title="Delivery addresses"><button mat-flat-button color="primary" (click)="edit(null)"><mat-icon>add</mat-icon> Add address</button></app-page-header>
    @if (form) { <div class="card" style="margin-bottom:16px"><h3 style="margin-top:0">{{ editing ? 'Edit' : 'New' }} address</h3>
      <form [formGroup]="f" (ngSubmit)="save()"><div class="form-grid">
        <mat-form-field><mat-label>Label (Home, Work…)</mat-label><input matInput formControlName="label"></mat-form-field>
        <mat-form-field><mat-label>Address line 1</mat-label><input matInput formControlName="line1"></mat-form-field>
        <mat-form-field><mat-label>Address line 2</mat-label><input matInput formControlName="line2"></mat-form-field>
        <mat-form-field><mat-label>City</mat-label><input matInput formControlName="city"></mat-form-field>
        <mat-form-field><mat-label>State</mat-label><input matInput formControlName="state"></mat-form-field>
        <mat-form-field><mat-label>Postal code</mat-label><input matInput formControlName="postalCode"></mat-form-field>
        <mat-form-field><mat-label>Latitude</mat-label><input matInput type="number" formControlName="latitude"></mat-form-field>
        <mat-form-field><mat-label>Longitude</mat-label><input matInput type="number" formControlName="longitude"></mat-form-field></div>
        <mat-checkbox formControlName="makeDefault">Make default</mat-checkbox>
        <div class="row" style="margin-top:8px"><button mat-flat-button color="primary" [disabled]="f.invalid">Save</button><button mat-button type="button" (click)="form = false">Cancel</button></div></form></div> }
    <div class="grid">@for (a of list(); track a.id) { <div class="card"><div class="row"><b>{{ a.label }}</b>@if (a.defaultAddress) {<span class="chip green">default</span>}</div>
      <div>{{ a.line1 }} {{ a.line2 }}</div><div class="muted">{{ a.city }}, {{ a.state }} {{ a.postalCode }}</div>
      <div class="row" style="margin-top:8px"><button mat-button (click)="edit(a)">Edit</button>@if (!a.defaultAddress) {<button mat-button (click)="makeDefault(a)">Make default</button>}<button mat-button color="warn" (click)="remove(a)">Delete</button></div></div> }</div>
    @if (!list().length && !form) { <app-empty icon="place" text="No addresses saved" /> }</div>`
})
export class AddressesComponent implements OnInit {
  private api = inject(CustomerApi); private fb = inject(FormBuilder); private dlg = inject(Dialogs);
  list = signal<Address[]>([]); form = false; editing: Address | null = null;
  f = this.fb.group({ label: ['Home', Validators.required], line1: ['', Validators.required], line2: [''], city: ['', Validators.required], state: [''], postalCode: ['', Validators.required], latitude: [null as number | null], longitude: [null as number | null], makeDefault: [false] });
  ngOnInit() { this.load(); }
  load() { this.api.addresses().subscribe(a => this.list.set(a)); }
  edit(a: Address | null) { this.editing = a; this.form = true; this.f.reset({ label: a?.label ?? 'Home', line1: a?.line1 ?? '', line2: a?.line2 ?? '', city: a?.city ?? '', state: a?.state ?? '', postalCode: a?.postalCode ?? '', latitude: a?.latitude ?? null, longitude: a?.longitude ?? null, makeDefault: a?.defaultAddress ?? false }); }
  save() { const call = this.editing ? this.api.updateAddress(this.editing.id, this.f.value) : this.api.addAddress(this.f.value); call.subscribe(() => { this.form = false; this.load(); }); }
  makeDefault(a: Address) { this.api.defaultAddress(a.id).subscribe(() => this.load()); }
  remove(a: Address) { this.dlg.confirm('Delete address?', `${a.label}: ${a.line1}`, { danger: true, confirmText: 'Delete' }).subscribe(ok => ok && this.api.deleteAddress(a.id).subscribe(() => this.load())); }
}

@Component({
  selector: 'app-payment-methods', imports: [UI, PageHeaderComponent, EmptyComponent],
  template: `<div class="page"><app-page-header title="Payment methods" subtitle="Only a provider token and a masked value are stored: never card numbers or PINs" />
    <div class="card" style="margin-bottom:16px"><form [formGroup]="f" (ngSubmit)="save()" class="row">
      <mat-form-field style="width:130px"><mat-label>Type</mat-label><mat-select formControlName="type"><mat-option value="CARD">Card</mat-option><mat-option value="UPI">UPI</mat-option><mat-option value="WALLET">Wallet</mat-option></mat-select></mat-form-field>
      <mat-form-field style="width:200px"><mat-label>Label</mat-label><input matInput formControlName="label"></mat-form-field>
      <mat-form-field style="width:160px"><mat-label>Masked value</mat-label><input matInput formControlName="maskedValue" placeholder="**** 4242"></mat-form-field>
      <mat-form-field style="width:200px"><mat-label>Sandbox outcome</mat-label><mat-select formControlName="providerToken"><mat-option value="tok_success">Always succeeds</mat-option><mat-option value="tok_fail">Always declined</mat-option><mat-option value="tok_refund_fail">Refund fails</mat-option></mat-select></mat-form-field>
      <mat-checkbox formControlName="makeDefault">Default</mat-checkbox><button mat-flat-button color="primary" [disabled]="f.invalid">Save method</button></form></div>
    <div class="grid">@for (m of list(); track m.id) { <div class="card row"><mat-icon>credit_card</mat-icon><div class="grow"><b>{{ m.label }}</b> <span class="chip gray">{{ m.type }}</span>@if (m.defaultMethod) {<span class="chip green">default</span>}<div class="muted">{{ m.maskedValue }}</div></div><button mat-icon-button (click)="remove(m)"><mat-icon>delete</mat-icon></button></div> }</div>
    @if (!list().length) { <app-empty icon="credit_card" text="No saved payment methods" /> }</div>`
})
export class PaymentMethodsComponent implements OnInit {
  private api = inject(CustomerApi); private fb = inject(FormBuilder);
  list = signal<SavedMethod[]>([]);
  f = this.fb.nonNullable.group({ type: ['CARD'], label: ['', Validators.required], maskedValue: ['', [Validators.required, Validators.pattern(/^[^0-9]*[0-9]{0,4}[^0-9]*$/)]], providerToken: ['tok_success'], makeDefault: [false] });
  ngOnInit() { this.load(); }
  load() { this.api.methods().subscribe(m => this.list.set(m)); }
  save() { this.api.saveMethod(this.f.getRawValue()).subscribe(() => { this.f.reset({ type: 'CARD', label: '', maskedValue: '', providerToken: 'tok_success', makeDefault: false }); this.load(); }); }
  remove(m: SavedMethod) { this.api.deleteMethod(m.id).subscribe(() => this.load()); }
}

/** Shared by every role (customer, owner, delivery partner, admin). */
@Component({
  selector: 'app-notifications', imports: [UI, PageHeaderComponent, EmptyComponent, TimeAgoPipe, DatePipe],
  template: `<div class="page"><app-page-header title="Notifications"><mat-slide-toggle [(ngModel)]="unreadOnly" (change)="load(0)">Unread only</mat-slide-toggle><button mat-stroked-button (click)="all()">Mark all read</button></app-page-header>
    @for (n of list(); track n.id) { <div class="card" style="margin-bottom:8px;cursor:pointer" [style.border-left]="n.read ? 'none' : '4px solid #f97316'" (click)="open(n)">
      <div class="row"><b>{{ n.title }}</b><span class="muted right" [title]="n.createdAt | date: 'medium'">{{ n.createdAt | timeAgo }}</span></div><div class="muted">{{ n.message }}</div></div> }
    @if (!list().length) { <app-empty icon="notifications_none" text="You are all caught up" /> }
    <mat-paginator [length]="total()" [pageSize]="20" [pageIndex]="page()" [hidePageSize]="true" (page)="load($event.pageIndex)" /></div>`
})
export class NotificationsComponent implements OnInit {
  private api = inject(CustomerApi); private router = inject(Router); private auth = inject(AuthService);
  list = signal<Notification[]>([]); total = signal(0); page = signal(0); unreadOnly = false;
  ngOnInit() { this.load(0); }
  load(p: number) { this.api.notifications(this.unreadOnly, p).subscribe(r => { this.list.set(r.content); this.total.set(r.totalElements); this.page.set(r.page); }); }
  all() { this.api.readAll().subscribe(() => this.load(0)); }
  open(n: Notification) {
    if (!n.read) this.api.markRead(n.id).subscribe(() => { n.read = true; });
    if (n.referenceType === 'ORDER' && n.referenceId) {
      if (this.auth.hasRole('CUSTOMER')) this.router.navigate(['/customer/orders', n.referenceId]);
      else if (this.auth.hasRole('RESTAURANT_OWNER')) this.router.navigate(['/owner/orders']);
    }
  }
}
