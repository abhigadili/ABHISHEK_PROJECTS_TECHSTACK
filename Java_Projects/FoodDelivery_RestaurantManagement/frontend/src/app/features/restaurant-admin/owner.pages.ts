import { Component, Injectable, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormArray, FormBuilder, Validators } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { interval, Subscription } from 'rxjs';
import { OwnerApi } from '../../core/services/owner-api';
import { Ingredient, Menu, MenuItem, Order, OrderSummary, Restaurant, Review } from '../../core/models';
import { UI } from '../../shared/material';
import { MoneyPipe } from '../../shared/pipes/pipes';
import { EmptyComponent, PageHeaderComponent, StarsComponent, StatusChipComponent } from '../../shared/components/small.components';
import { Dialogs } from '../../shared/components/dialogs';

/** Holds the owner's restaurants and the currently selected one (shared by all owner screens). */
@Injectable({ providedIn: 'root' })
export class OwnerContext {
  private api = inject(OwnerApi);
  restaurants = signal<Restaurant[]>([]);
  selectedId = signal<number | null>(null);
  loaded = signal(false);
  selected = computed(() => this.restaurants().find(r => r.id === this.selectedId()) ?? null);
  load() { return this.api.mine().subscribe(r => { this.restaurants.set(r); if (!this.selectedId() && r.length) this.selectedId.set(r[0].id); this.loaded.set(true); }); }
  replace(r: Restaurant) { this.restaurants.update(l => l.map(x => (x.id === r.id ? r : x))); }
}

@Component({
  selector: 'app-restaurant-picker', imports: [UI],
  template: `@if (ctx.restaurants().length > 1) { <mat-form-field style="width:260px"><mat-label>Restaurant</mat-label><mat-select [value]="ctx.selectedId()" (selectionChange)="ctx.selectedId.set($event.value)">@for (r of ctx.restaurants(); track r.id) {<mat-option [value]="r.id">{{ r.name }}</mat-option>}</mat-select></mat-form-field> }`
})
export class RestaurantPickerComponent { ctx = inject(OwnerContext); }

// ===================================================================================================== dashboard
@Component({
  selector: 'app-owner-dashboard', imports: [UI, MoneyPipe, DatePipe, PageHeaderComponent, StatusChipComponent, RestaurantPickerComponent, EmptyComponent],
  template: `<div class="page"><app-page-header title="Restaurant dashboard"><app-restaurant-picker /></app-page-header>
    @if (ctx.loaded() && !ctx.selected()) { <app-empty icon="storefront" text="You have not registered a restaurant yet"><a mat-flat-button color="primary" routerLink="/owner/restaurant">Register your restaurant</a></app-empty> }
    @if (ctx.selected(); as r) {
      <div class="card row" style="margin-bottom:16px"><div><h2 style="margin:0">{{ r.name }}</h2><div class="muted">{{ r.addressLine }}, {{ r.city }}</div></div><app-status [value]="r.status" />
        @if (r.status === 'PENDING') { <span class="muted">Awaiting admin approval: you can prepare your menu in the meantime.</span> }
        @if (r.statusReason) { <span class="warn">{{ r.statusReason }}</span> }
        <span class="right row"><mat-slide-toggle [checked]="r.acceptingOrders" (change)="toggle($event.checked)">Accepting orders</mat-slide-toggle></span></div>
      <div class="grid-sm" style="margin-bottom:16px">
        <div class="card"><div class="stat-label">Orders received</div><div class="stat">{{ sales()?.totalOrders ?? 0 }}</div></div>
        <div class="card"><div class="stat-label">Delivered</div><div class="stat">{{ sales()?.deliveredOrders ?? 0 }}</div></div>
        <div class="card"><div class="stat-label">In progress</div><div class="stat">{{ sales()?.inProgress ?? 0 }}</div></div>
        <div class="card"><div class="stat-label">Cancelled / rejected</div><div class="stat">{{ sales()?.cancelledOrRejected ?? 0 }}</div></div>
        <div class="card"><div class="stat-label">Delivered revenue</div><div class="stat">{{ sales()?.deliveredRevenue ?? 0 | money }}</div></div>
        <div class="card"><div class="stat-label">Rating</div><div class="stat">{{ r.avgRating }} ★</div><div class="muted">{{ r.ratingCount }} reviews</div></div></div>
      <h2>Orders waiting for you</h2>
      @for (o of pending(); track o.id) { <a class="card row" [routerLink]="['/owner/orders']" style="margin-bottom:8px;color:inherit;text-decoration:none"><b>{{ o.orderNumber }}</b><span class="muted">{{ o.customerName }} · {{ o.createdAt | date: 'HH:mm' }}</span><app-status [value]="o.status" /><b class="right">{{ o.totalAmount | money }}</b></a> }
      @if (!pending().length) { <div class="muted">No orders waiting</div> }
      @if (low().length) { <h2>Low stock</h2><div class="row">@for (i of low(); track i.id) { <span class="chip red">{{ i.name }}: {{ i.quantity }} {{ i.unit }}</span> }</div> }
    }</div>`
})
export class OwnerDashboardComponent implements OnInit, OnDestroy {
  ctx = inject(OwnerContext); private api = inject(OwnerApi);
  sales = signal<any>(null); pending = signal<OrderSummary[]>([]); low = signal<Ingredient[]>([]); private sub?: Subscription;
  ngOnInit() { this.ctx.load(); this.sub = interval(8000).subscribe(() => this.refresh()); setTimeout(() => this.refresh(), 600); }
  ngOnDestroy() { this.sub?.unsubscribe(); }
  refresh() {
    const id = this.ctx.selectedId(); if (!id) return;
    this.api.sales(id).subscribe(s => this.sales.set(s));
    this.api.orders(id, { size: 50 }).subscribe(p => this.pending.set(p.content.filter(o => ['CONFIRMED', 'RESTAURANT_ACCEPTED', 'PREPARING'].includes(o.status))));
    this.api.ingredients(id).subscribe(i => this.low.set(i.filter(x => x.lowStock)));
  }
  toggle(open: boolean) { this.api.availability(this.ctx.selectedId()!, open).subscribe(r => this.ctx.replace(r)); }
}

// ===================================================================================================== restaurant profile
const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];

@Component({
  selector: 'app-owner-restaurant', imports: [UI, PageHeaderComponent, StatusChipComponent, RestaurantPickerComponent],
  template: `<div class="page"><app-page-header [title]="ctx.selected() ? 'Restaurant profile' : 'Register your restaurant'"><app-restaurant-picker />
      <button mat-stroked-button (click)="newOne()"><mat-icon>add</mat-icon> Another restaurant</button></app-page-header>
    <div class="card"><form [formGroup]="f" (ngSubmit)="save()">
      <div class="form-grid">
        <mat-form-field><mat-label>Name</mat-label><input matInput formControlName="name"></mat-form-field>
        <mat-form-field><mat-label>Category</mat-label><input matInput formControlName="category" placeholder="Casual Dining, Cafe…"></mat-form-field>
        <mat-form-field><mat-label>Cuisines (comma separated)</mat-label><input matInput formControlName="cuisines"></mat-form-field>
        <mat-form-field><mat-label>Phone</mat-label><input matInput formControlName="phone"></mat-form-field>
        <mat-form-field><mat-label>E-mail</mat-label><input matInput formControlName="email"></mat-form-field>
        <mat-form-field><mat-label>Address</mat-label><input matInput formControlName="addressLine"></mat-form-field>
        <mat-form-field><mat-label>City</mat-label><input matInput formControlName="city"></mat-form-field>
        <mat-form-field><mat-label>State</mat-label><input matInput formControlName="state"></mat-form-field>
        <mat-form-field><mat-label>Postal code</mat-label><input matInput formControlName="postalCode"></mat-form-field>
        <mat-form-field><mat-label>Latitude</mat-label><input matInput type="number" formControlName="latitude"></mat-form-field>
        <mat-form-field><mat-label>Longitude</mat-label><input matInput type="number" formControlName="longitude"></mat-form-field>
        <mat-form-field><mat-label>Minimum order (₹)</mat-label><input matInput type="number" formControlName="minOrderAmount"></mat-form-field>
        <mat-form-field><mat-label>Delivery fee (₹)</mat-label><input matInput type="number" formControlName="deliveryFee"></mat-form-field>
        <mat-form-field><mat-label>Preparation time (min)</mat-label><input matInput type="number" formControlName="prepTimeMinutes"></mat-form-field></div>
      <mat-form-field><mat-label>Description</mat-label><textarea matInput formControlName="description" rows="2"></textarea></mat-form-field>
      <mat-checkbox formControlName="pureVeg">Pure vegetarian</mat-checkbox>
      <div class="row" style="margin-top:12px"><button mat-flat-button color="primary" [disabled]="f.invalid">{{ ctx.selected() && !creating ? 'Save changes' : 'Submit for approval' }}</button>
        @if (ctx.selected() && !creating) { <app-status [value]="ctx.selected()!.status" /> }</div></form></div>
    @if (ctx.selected(); as r) { @if (!creating) {
      <h2>Opening hours</h2><div class="card"><form [formGroup]="hf" (ngSubmit)="saveHours()">
        @for (d of hours.controls; track $index) { <div class="row" [formGroup]="$any(d)"><b style="width:110px">{{ $any(d).value.dayOfWeek }}</b>
          <mat-checkbox formControlName="closed">Closed</mat-checkbox>
          <mat-form-field style="width:130px"><mat-label>Opens</mat-label><input matInput type="time" formControlName="opensAt"></mat-form-field>
          <mat-form-field style="width:130px"><mat-label>Closes</mat-label><input matInput type="time" formControlName="closesAt"></mat-form-field></div> }
        <button mat-flat-button color="primary">Save opening hours</button><span class="muted"> No hours = always open. Overnight spans (18:00–02:00) are supported.</span></form></div>
      <h2>Logo & photos</h2><div class="card row"><div><div class="muted">Logo</div><input type="file" accept="image/png,image/jpeg,image/webp" (change)="logo($event)"></div>
        <div><div class="muted">Add photo (max 8)</div><input type="file" accept="image/png,image/jpeg,image/webp" (change)="photo($event)"></div>
        @if (r.logoUrl) { <img class="dish-img" [src]="r.logoUrl" alt="logo"> } @for (u of r.imageUrls; track u) { <img class="dish-img" [src]="u" alt=""> }</div> } }</div>`
})
export class OwnerRestaurantComponent implements OnInit {
  ctx = inject(OwnerContext); private api = inject(OwnerApi); private fb = inject(FormBuilder); private snack = inject(MatSnackBar);
  creating = false;
  f = this.fb.group({ name: ['', Validators.required], category: [''], cuisines: ['', Validators.required], phone: [''], email: [''], addressLine: ['', Validators.required], city: ['', Validators.required],
    state: [''], postalCode: [''], latitude: [null as number | null], longitude: [null as number | null], minOrderAmount: [0], deliveryFee: [30], prepTimeMinutes: [25], description: [''], pureVeg: [false] });
  hf = this.fb.group({ hours: this.fb.array(DAYS.map(d => this.fb.group({ dayOfWeek: [d], closed: [false], opensAt: ['09:00'], closesAt: ['23:00'] }))) });
  get hours() { return this.hf.controls.hours as FormArray; }
  ngOnInit() { this.ctx.load(); setTimeout(() => this.fill(), 500); }
  private fill() {
    const r = this.ctx.selected(); if (!r || this.creating) return;
    this.f.patchValue({ ...r, cuisines: r.cuisines.join(', '), phone: r.phone ?? '', email: r.email ?? '', description: r.description ?? '', category: r.category ?? '', state: r.state ?? '', postalCode: r.postalCode ?? '' } as any);
    if (r.hours.length) r.hours.forEach(h => { const i = DAYS.indexOf(h.dayOfWeek); if (i >= 0) this.hours.at(i).patchValue({ closed: h.closed, opensAt: (h.opensAt ?? '09:00').slice(0, 5), closesAt: (h.closesAt ?? '23:00').slice(0, 5) }); });
  }
  newOne() { this.creating = true; this.f.reset({ minOrderAmount: 0, deliveryFee: 30, prepTimeMinutes: 25, pureVeg: false }); }
  save() {
    const v = this.f.getRawValue();
    const body = { ...v, cuisines: (v.cuisines ?? '').split(',').map(s => s.trim()).filter(Boolean), email: v.email || null, phone: v.phone || null };
    const sel = this.ctx.selected();
    if (sel && !this.creating) this.api.update(sel.id, body).subscribe(r => { this.ctx.replace(r); this.snack.open('Saved', undefined, { duration: 2000 }); });
    else this.api.create(body).subscribe(r => { this.creating = false; this.ctx.restaurants.update(l => [...l, r]); this.ctx.selectedId.set(r.id); this.snack.open('Submitted: an administrator will review it', undefined, { duration: 4000 }); });
  }
  saveHours() {
    const hours = this.hours.getRawValue().map((h: any) => ({ dayOfWeek: h.dayOfWeek, closed: h.closed, opensAt: h.closed ? null : h.opensAt + ':00', closesAt: h.closed ? null : h.closesAt + ':00' }));
    this.api.hours(this.ctx.selectedId()!, hours).subscribe(r => { this.ctx.replace(r); this.snack.open('Opening hours saved', undefined, { duration: 2000 }); });
  }
  logo(e: Event) { const f = (e.target as HTMLInputElement).files?.[0]; if (f) this.api.logo(this.ctx.selectedId()!, f).subscribe(r => this.ctx.replace(r)); }
  photo(e: Event) { const f = (e.target as HTMLInputElement).files?.[0]; if (f) this.api.image(this.ctx.selectedId()!, f).subscribe(r => this.ctx.replace(r)); }
}

// ===================================================================================================== menu management
@Component({
  selector: 'app-item-form', imports: [UI],
  template: `<h2 mat-dialog-title>{{ d.item ? 'Edit' : 'New' }} food item</h2><mat-dialog-content style="min-width:min(560px,85vw)"><form [formGroup]="f">
    <div class="form-grid"><mat-form-field><mat-label>Name</mat-label><input matInput formControlName="name"></mat-form-field>
      <mat-form-field><mat-label>Category</mat-label><mat-select formControlName="categoryId">@for (c of d.categories; track c.id) {<mat-option [value]="c.id">{{ c.name }}</mat-option>}</mat-select></mat-form-field>
      <mat-form-field><mat-label>Base price (₹)</mat-label><input matInput type="number" formControlName="basePrice"></mat-form-field>
      <mat-form-field><mat-label>Prep time (min)</mat-label><input matInput type="number" formControlName="prepTimeMinutes"></mat-form-field></div>
    <mat-form-field><mat-label>Description</mat-label><textarea matInput formControlName="description" rows="2"></textarea></mat-form-field>
    <mat-form-field><mat-label>Tags (comma separated)</mat-label><input matInput formControlName="tags"></mat-form-field>
    <mat-checkbox formControlName="vegetarian">Vegetarian</mat-checkbox>
    <h3>Sizes / variants <button mat-icon-button type="button" (click)="addVariant()"><mat-icon>add_circle</mat-icon></button></h3>
    @for (v of variants.controls; track $index) { <div class="row" [formGroup]="$any(v)"><mat-form-field style="width:200px"><mat-label>Name</mat-label><input matInput formControlName="name"></mat-form-field>
      <mat-form-field style="width:150px"><mat-label>Extra price</mat-label><input matInput type="number" formControlName="extraPrice"></mat-form-field><button mat-icon-button type="button" (click)="variants.removeAt($index)"><mat-icon>delete</mat-icon></button></div> }
    <h3>Add-ons <button mat-icon-button type="button" (click)="addAddOn()"><mat-icon>add_circle</mat-icon></button></h3>
    @for (a of addOns.controls; track $index) { <div class="row" [formGroup]="$any(a)"><mat-form-field style="width:200px"><mat-label>Name</mat-label><input matInput formControlName="name"></mat-form-field>
      <mat-form-field style="width:150px"><mat-label>Price</mat-label><input matInput type="number" formControlName="price"></mat-form-field><button mat-icon-button type="button" (click)="addOns.removeAt($index)"><mat-icon>delete</mat-icon></button></div> }
  </form></mat-dialog-content>
  <mat-dialog-actions align="end"><button mat-button mat-dialog-close>Cancel</button><button mat-flat-button color="primary" [disabled]="f.invalid" [mat-dialog-close]="value()">Save</button></mat-dialog-actions>`
})
export class ItemFormDialog {
  d = inject<{ item?: MenuItem; categories: { id: number; name: string }[] }>(MAT_DIALOG_DATA);
  private fb = inject(FormBuilder);
  f = this.fb.group({ name: [this.d.item?.name ?? '', Validators.required], categoryId: [this.d.item?.categoryId ?? this.d.categories[0]?.id, Validators.required], basePrice: [this.d.item?.basePrice ?? 0, [Validators.required, Validators.min(0.01)]],
    prepTimeMinutes: [this.d.item?.prepTimeMinutes ?? 15], description: [this.d.item?.description ?? ''], tags: [this.d.item?.tags ?? ''], vegetarian: [this.d.item?.vegetarian ?? false],
    variants: this.fb.array((this.d.item?.variants ?? []).map(v => this.fb.group({ name: [v.name, Validators.required], extraPrice: [v.extraPrice] }))),
    addOns: this.fb.array((this.d.item?.addOns ?? []).map(a => this.fb.group({ name: [a.name, Validators.required], price: [a.price] }))) });
  get variants() { return this.f.controls.variants as FormArray; } get addOns() { return this.f.controls.addOns as FormArray; }
  addVariant() { this.variants.push(this.fb.group({ name: ['', Validators.required], extraPrice: [0] })); }
  addAddOn() { this.addOns.push(this.fb.group({ name: ['', Validators.required], price: [0] })); }
  value() { return this.f.getRawValue(); }
}

@Component({
  selector: 'app-owner-menu', imports: [UI, MoneyPipe, PageHeaderComponent, RestaurantPickerComponent, EmptyComponent],
  template: `<div class="page"><app-page-header title="Menu management" subtitle="Changes publish events and invalidate the customers' menu cache"><app-restaurant-picker /></app-page-header>
    @if (!ctx.selected()) { <app-empty icon="restaurant_menu" text="Register a restaurant first" /> } @else {
      <div class="card row" style="margin-bottom:16px"><mat-form-field style="width:260px"><mat-label>New category</mat-label><input matInput [(ngModel)]="newCat" (keyup.enter)="addCategory()"></mat-form-field>
        <button mat-flat-button color="primary" (click)="addCategory()" [disabled]="!newCat.trim()">Add category</button>
        <button mat-flat-button color="primary" class="right" (click)="editItem(null)" [disabled]="!menu()?.categories?.length"><mat-icon>add</mat-icon> Add food item</button></div>
      @for (c of menu()?.categories ?? []; track c.id) {
        <div class="row"><h2>{{ c.name }}</h2><button mat-icon-button (click)="renameCategory(c)"><mat-icon>edit</mat-icon></button><button mat-icon-button (click)="deleteCategory(c)"><mat-icon>delete</mat-icon></button></div>
        <div class="grid">@for (i of c.items; track i.id) { <div class="card" style="display:flex;gap:12px">
          @if (i.imageUrl) { <img class="dish-img" [src]="i.imageUrl" alt=""> }
          <div class="grow"><b><span [style.color]="i.vegetarian ? '#15803d' : '#b91c1c'">●</span> {{ i.name }}</b><div class="muted">{{ i.description }}</div>
            <div>{{ i.basePrice | money }} @for (v of i.variants; track v.name) {<span class="chip gray">{{ v.name }}{{ v.extraPrice ? ' +' + v.extraPrice : '' }}</span>} @for (a of i.addOns; track a.id) {<span class="chip amber">{{ a.name }} +{{ a.price }}</span>}</div>
            <div class="row" style="margin-top:6px"><mat-slide-toggle [checked]="i.available" (change)="avail(i, $event.checked)">Available</mat-slide-toggle>
              <button mat-icon-button (click)="editItem(i)" matTooltip="Edit"><mat-icon>edit</mat-icon></button>
              <label matTooltip="Upload image" style="cursor:pointer"><mat-icon>image</mat-icon><input type="file" hidden accept="image/png,image/jpeg,image/webp" (change)="image(i, $event)"></label>
              <button mat-icon-button (click)="remove(i)" matTooltip="Deactivate"><mat-icon>delete</mat-icon></button></div></div></div> }</div>
        @if (!c.items.length) { <div class="muted">No items in this category</div> } }
      @if (!menu()?.categories?.length) { <app-empty icon="restaurant_menu" text="Create your first category, then add food items" /> } }</div>`
})
export class OwnerMenuComponent implements OnInit {
  ctx = inject(OwnerContext); private api = inject(OwnerApi); private dialog = inject(MatDialog); private dlg = inject(Dialogs);
  menu = signal<Menu | null>(null); newCat = '';
  ngOnInit() { this.ctx.load(); setTimeout(() => this.load(), 500); }
  load() { const id = this.ctx.selectedId(); if (id) this.api.menu(id).subscribe(m => this.menu.set(m)); }
  addCategory() { this.api.addCategory(this.ctx.selectedId()!, { name: this.newCat.trim(), displayOrder: (this.menu()?.categories.length ?? 0) + 1 }).subscribe(() => { this.newCat = ''; this.load(); }); }
  renameCategory(c: any) { const name = prompt('Category name', c.name); if (name) this.api.updateCategory(c.id, { name, displayOrder: c.displayOrder }).subscribe(() => this.load()); }
  deleteCategory(c: any) { this.dlg.confirm('Delete category?', c.name, { danger: true }).subscribe(ok => ok && this.api.deleteCategory(c.id).subscribe(() => this.load())); }
  editItem(item: MenuItem | null) {
    const categories = (this.menu()?.categories ?? []).map(c => ({ id: c.id, name: c.name }));
    this.dialog.open(ItemFormDialog, { data: { item, categories }, maxWidth: '95vw' }).afterClosed().subscribe(v => {
      if (!v) return;
      const call = item ? this.api.updateItem(item.id, v) : this.api.addItem(this.ctx.selectedId()!, v);
      call.subscribe(() => this.load());
    });
  }
  avail(i: MenuItem, a: boolean) { this.api.itemAvailability(i.id, a).subscribe(() => this.load()); }
  remove(i: MenuItem) { this.dlg.confirm('Deactivate item?', `${i.name} disappears from the menu (past orders keep it).`, { danger: true }).subscribe(ok => ok && this.api.deleteItem(i.id).subscribe(() => this.load())); }
  image(i: MenuItem, e: Event) { const f = (e.target as HTMLInputElement).files?.[0]; if (f) this.api.itemImage(i.id, f).subscribe(() => this.load()); }
}

// ===================================================================================================== incoming orders
@Component({
  selector: 'app-owner-orders', imports: [UI, MoneyPipe, DatePipe, PageHeaderComponent, StatusChipComponent, RestaurantPickerComponent, EmptyComponent],
  template: `<div class="page"><app-page-header title="Orders" subtitle="Live (refreshes every 5 s). Only the actions the order state allows are offered."><app-restaurant-picker /></app-page-header>
    <mat-button-toggle-group [(ngModel)]="filter" (change)="load()" style="margin-bottom:12px"><mat-button-toggle value="">All</mat-button-toggle><mat-button-toggle value="CONFIRMED">New</mat-button-toggle>
      <mat-button-toggle value="RESTAURANT_ACCEPTED">Accepted</mat-button-toggle><mat-button-toggle value="PREPARING">Preparing</mat-button-toggle><mat-button-toggle value="READY_FOR_PICKUP">Ready</mat-button-toggle><mat-button-toggle value="DELIVERED">Delivered</mat-button-toggle></mat-button-toggle-group>
    @for (o of orders(); track o.id) {
      <mat-expansion-panel (opened)="open(o)" style="margin-bottom:8px"><mat-expansion-panel-header><mat-panel-title><b>{{ o.orderNumber }}</b>&nbsp;<span class="muted">{{ o.customerName }} · {{ o.createdAt | date: 'dd MMM HH:mm' }}</span></mat-panel-title>
        <mat-panel-description><app-status [value]="o.status" /> <b style="margin-left:12px">{{ o.totalAmount | money }}</b></mat-panel-description></mat-expansion-panel-header>
        @if (detail()[o.id]; as d) {
          @for (i of d.items; track $index) { <div>{{ i.quantity }} × {{ i.name }} @if (i.variant) {<span class="chip gray">{{ i.variant }}</span>} @if (i.addOns) {<span class="muted">+ {{ i.addOns }}</span>} @if (i.instructions) {<i class="muted"> “{{ i.instructions }}”</i>}</div> }
          @if (d.specialInstructions) { <div class="warn">📝 {{ d.specialInstructions }}</div> }
          <div class="muted">Deliver to {{ d.deliveryAddress }}</div>
          <div class="row" style="margin-top:8px">
            @if (d.allowedActions.includes('ACCEPT')) { <button mat-flat-button color="primary" (click)="act(o, 'accept')">Accept</button> }
            @if (d.allowedActions.includes('PREPARE')) { <button mat-flat-button color="primary" (click)="act(o, 'prepare')">Start preparing</button> }
            @if (d.allowedActions.includes('READY')) { <button mat-flat-button color="primary" (click)="act(o, 'ready')">Mark ready for pickup</button> }
            @if (d.allowedActions.includes('REJECT')) { <button mat-stroked-button color="warn" (click)="reject(o)">Reject</button> }</div> } </mat-expansion-panel> }
    @if (!orders().length) { <app-empty icon="receipt_long" text="No orders" /> }
    <mat-paginator [length]="total()" [pageSize]="20" [pageIndex]="page()" [hidePageSize]="true" (page)="page.set($event.pageIndex); load()" /></div>`
})
export class OwnerOrdersComponent implements OnInit, OnDestroy {
  ctx = inject(OwnerContext); private api = inject(OwnerApi); private dlg = inject(Dialogs);
  orders = signal<OrderSummary[]>([]); total = signal(0); page = signal(0); detail = signal<Record<number, Order>>({}); filter = ''; private sub?: Subscription;
  ngOnInit() { this.ctx.load(); setTimeout(() => this.load(), 500); this.sub = interval(5000).subscribe(() => { this.load(); Object.keys(this.detail()).forEach(k => this.refreshDetail(Number(k))); }); }
  ngOnDestroy() { this.sub?.unsubscribe(); }
  load() { const id = this.ctx.selectedId(); if (id) this.api.orders(id, { status: this.filter, page: this.page(), size: 20 }).subscribe(p => { this.orders.set(p.content); this.total.set(p.totalElements); }); }
  open(o: OrderSummary) { this.refreshDetail(o.id); }
  private refreshDetail(id: number) { this.api.order(id).subscribe(d => this.detail.update(m => ({ ...m, [id]: d }))); }
  act(o: OrderSummary, a: 'accept' | 'prepare' | 'ready') { this.api.action(o.id, a).subscribe(() => { this.refreshDetail(o.id); this.load(); }); }
  reject(o: OrderSummary) { this.dlg.confirm('Reject this order?', 'The customer is refunded automatically.', { danger: true, confirmText: 'Reject', reasonLabel: 'Reason' }).subscribe(r => r && this.api.action(o.id, 'reject', r.reason || 'Rejected by restaurant').subscribe(() => { this.refreshDetail(o.id); this.load(); })); }
}

// ===================================================================================================== inventory
@Component({
  selector: 'app-owner-inventory', imports: [UI, DatePipe, PageHeaderComponent, RestaurantPickerComponent, EmptyComponent],
  template: `<div class="page"><app-page-header title="Inventory" subtitle="Stock is consumed automatically when orders are confirmed (via Kafka) and returned on cancellation"><app-restaurant-picker /></app-page-header>
    @if (!ctx.selected()) { <app-empty icon="inventory_2" text="Register a restaurant first" /> } @else {
    <div class="card" style="margin-bottom:16px"><form [formGroup]="f" (ngSubmit)="add()" class="row">
      <mat-form-field style="width:200px"><mat-label>Ingredient</mat-label><input matInput formControlName="name"></mat-form-field>
      <mat-form-field style="width:90px"><mat-label>Unit</mat-label><input matInput formControlName="unit" placeholder="kg"></mat-form-field>
      <mat-form-field style="width:130px"><mat-label>Quantity</mat-label><input matInput type="number" formControlName="quantity"></mat-form-field>
      <mat-form-field style="width:150px"><mat-label>Alert at or below</mat-label><input matInput type="number" formControlName="lowStockThreshold"></mat-form-field>
      <button mat-flat-button color="primary" [disabled]="f.invalid">Add ingredient</button></form></div>
    <table class="simple"><thead><tr><th>Ingredient</th><th>Stock</th><th>Alert level</th><th>Status</th><th></th></tr></thead><tbody>
      @for (i of list(); track i.id) { <tr><td>{{ i.name }}</td><td><b>{{ i.quantity }}</b> {{ i.unit }}</td><td>{{ i.lowStockThreshold }}</td><td><span class="chip" [class.red]="i.lowStock" [class.green]="!i.lowStock">{{ i.lowStock ? 'LOW' : 'OK' }}</span></td>
        <td style="white-space:nowrap"><button mat-button (click)="restock(i)">Restock</button><button mat-button (click)="adjust(i)">Adjust</button><button mat-button (click)="history(i)">History</button></td></tr> }</tbody></table>
    @if (hist()) { <h2>History: {{ histName() }}</h2><table class="simple"><thead><tr><th>When</th><th>Type</th><th>Change</th><th>Balance</th><th>Reason</th></tr></thead><tbody>
      @for (h of hist(); track h.id) { <tr><td>{{ h.createdAt | date: 'dd MMM HH:mm:ss' }}</td><td>{{ h.type }}</td><td [class.ok]="h.delta > 0" [class.bad]="h.delta < 0">{{ h.delta }}</td><td>{{ h.balanceAfter }}</td><td>{{ h.reason }}</td></tr> }</tbody></table> }
    <h2>Recipes (how much of each ingredient one portion uses)</h2>
    <div class="card"><div class="row"><mat-form-field style="width:260px"><mat-label>Menu item</mat-label><mat-select [(ngModel)]="recipeItem" (selectionChange)="loadRecipe()">@for (i of items(); track i.id) {<mat-option [value]="i.id">{{ i.name }}</mat-option>}</mat-select></mat-form-field></div>
      @if (recipeItem) { @for (l of recipeLines; track $index) { <div class="row"><mat-form-field style="width:220px"><mat-label>Ingredient</mat-label><mat-select [(ngModel)]="l.ingredientId">@for (i of list(); track i.id) {<mat-option [value]="i.id">{{ i.name }} ({{ i.unit }})</mat-option>}</mat-select></mat-form-field>
        <mat-form-field style="width:150px"><mat-label>Per portion</mat-label><input matInput type="number" [(ngModel)]="l.quantityPerPortion"></mat-form-field><button mat-icon-button (click)="recipeLines.splice($index, 1)"><mat-icon>delete</mat-icon></button></div> }
        <button mat-button (click)="recipeLines.push({ ingredientId: null, quantityPerPortion: 0.1 })"><mat-icon>add</mat-icon> Ingredient</button><button mat-flat-button color="primary" (click)="saveRecipe()">Save recipe</button>
        @if (portions() !== null) { <span class="muted"> Can cook ≈ {{ portions() }} portions now</span> } } </div> }</div>`
})
export class OwnerInventoryComponent implements OnInit {
  ctx = inject(OwnerContext); private api = inject(OwnerApi); private fb = inject(FormBuilder); private snack = inject(MatSnackBar);
  list = signal<Ingredient[]>([]); hist = signal<any[] | null>(null); histName = signal(''); items = signal<MenuItem[]>([]); portions = signal<number | null>(null);
  recipeItem: number | null = null; recipeLines: { ingredientId: number | null; quantityPerPortion: number }[] = [];
  f = this.fb.nonNullable.group({ name: ['', Validators.required], unit: ['kg', Validators.required], quantity: [0, Validators.required], lowStockThreshold: [0, Validators.required] });
  ngOnInit() { this.ctx.load(); setTimeout(() => this.load(), 500); }
  load() {
    const id = this.ctx.selectedId(); if (!id) return;
    this.api.ingredients(id).subscribe(i => this.list.set(i));
    this.api.menu(id).subscribe(m => this.items.set(m.categories.flatMap(c => c.items)));
  }
  add() { this.api.addIngredient(this.ctx.selectedId()!, this.f.getRawValue()).subscribe(() => { this.f.reset({ name: '', unit: 'kg', quantity: 0, lowStockThreshold: 0 }); this.load(); }); }
  restock(i: Ingredient) { const q = Number(prompt(`Add how many ${i.unit} of ${i.name}?`, '1')); if (q > 0) this.api.restock(i.id, q, 'Manual restock').subscribe(() => this.load()); }
  adjust(i: Ingredient) { const q = prompt(`Set the exact stock of ${i.name} (${i.unit})`, String(i.quantity)); if (q !== null && q !== '') this.api.adjust(i.id, Number(q), 'Manual stock count').subscribe({ next: () => this.load(), error: () => this.load() }); }
  history(i: Ingredient) { this.histName.set(i.name); this.api.history(i.id).subscribe(p => this.hist.set(p.content)); }
  loadRecipe() {
    this.api.recipes(this.ctx.selectedId()!).subscribe(rs => { const r = rs.find(x => x.menuItemId === this.recipeItem); this.recipeLines = (r?.lines ?? []).map((l: any) => ({ ingredientId: l.ingredientId, quantityPerPortion: l.quantityPerPortion })); });
    this.api.availability_(this.ctx.selectedId()!).subscribe(a => this.portions.set(a.find(x => x.menuItemId === this.recipeItem)?.portionsAvailable ?? null));
  }
  saveRecipe() { this.api.setRecipe(this.ctx.selectedId()!, this.recipeItem!, this.recipeLines.filter(l => l.ingredientId)).subscribe(() => { this.snack.open('Recipe saved', undefined, { duration: 2000 }); this.loadRecipe(); }); }
}

// ===================================================================================================== reviews
@Component({
  selector: 'app-owner-reviews', imports: [UI, DatePipe, PageHeaderComponent, StarsComponent, RestaurantPickerComponent, EmptyComponent],
  template: `<div class="page"><app-page-header title="Customer reviews"><app-restaurant-picker /></app-page-header>
    @if (summary(); as s) { <div class="card row" style="margin-bottom:16px"><div class="stat">{{ s.average }} ★</div><div class="muted">{{ s.count }} reviews</div>
      <div>@for (k of ['5','4','3','2','1']; track k) {<div class="muted">{{ k }}★ — {{ s.distribution[k] ?? 0 }}</div>}</div></div> }
    @for (r of list(); track r.id) { <div class="card" style="margin-bottom:8px"><div class="row"><b>{{ r.reviewerName }}</b><app-stars [value]="r.restaurantRating" /><span class="muted right">{{ r.createdAt | date: 'medium' }}</span></div><div>{{ r.comment }}</div>
      @for (ir of r.itemRatings; track ir.menuItemId) { <span class="chip gray">{{ ir.itemName }} {{ ir.rating }}★</span> }</div> }
    @if (!list().length) { <app-empty icon="star_border" text="No reviews yet" /> }</div>`
})
export class OwnerReviewsComponent implements OnInit {
  ctx = inject(OwnerContext); private api = inject(OwnerApi);
  list = signal<Review[]>([]); summary = signal<any>(null);
  ngOnInit() { this.ctx.load(); setTimeout(() => { const id = this.ctx.selectedId(); if (id) { this.api.reviews(id).subscribe(p => this.list.set(p.content)); this.api.reviewSummary(id).subscribe(s => this.summary.set(s)); } }, 600); }
}
