import { Component, Input, OnInit, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormBuilder, FormControl } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { debounceTime, distinctUntilChanged, of, switchMap } from 'rxjs';
import { CustomerApi } from '../../core/services/customer-api';
import { Menu, MenuItem, Restaurant, Review, Summary } from '../../core/models';
import { UI } from '../../shared/material';
import { MoneyPipe } from '../../shared/pipes/pipes';
import { EmptyComponent, PageHeaderComponent, StarsComponent } from '../../shared/components/small.components';
import { Dialogs } from '../../shared/components/dialogs';

@Component({
  selector: 'app-restaurant-card', imports: [UI, MoneyPipe, StarsComponent, DecimalPipe],
  template: `<a [routerLink]="['/customer/restaurants', r.id]" style="text-decoration:none;color:inherit">
    <div class="card" style="display:flex;gap:12px;height:100%">
      <img class="dish-img" [src]="r.logoUrl || 'data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2288%22 height=%2288%22><rect width=%2288%22 height=%2288%22 fill=%22%23fde68a%22/><text x=%2250%25%22 y=%2258%25%22 font-size=%2240%22 text-anchor=%22middle%22>🍽</text></svg>'" alt="">
      <div class="grow"><div style="font-weight:600">{{ r.name }}</div>
        <div class="muted">{{ r.cuisines.join(', ') }} · {{ r.city }}</div>
        <div class="row" style="gap:6px;margin-top:4px"><app-stars [value]="r.avgRating" /><span class="muted">{{ r.avgRating | number: '1.1-1' }} ({{ r.ratingCount }})</span></div>
        <div class="muted">{{ r.prepTimeMinutes }} min · delivery {{ r.deliveryFee | money }}@if (r.distanceKm != null) { · {{ r.distanceKm }} km }</div>
        <span class="chip" [class.green]="r.openNow" [class.red]="!r.openNow">{{ r.openNow ? 'Open now' : 'Closed' }}</span>
        @if (r.pureVeg) { <span class="chip green">Pure veg</span> }
      </div></div></a>`
})
export class RestaurantCardComponent { r!: Restaurant; @Input({ required: true }) set restaurant(v: Restaurant) { this.r = v; } }

@Component({
  selector: 'app-customer-home', imports: [UI, RestaurantCardComponent, MoneyPipe],
  template: `<div class="page">
    <div class="card" style="background:linear-gradient(135deg,#fb923c,#ef4444);color:#fff;padding:28px">
      <h1 style="color:#fff">What are you craving today?</h1>
      <mat-form-field appearance="outline" style="background:#fff;border-radius:8px;max-width:640px">
        <mat-label>Search restaurants, dishes, cuisines</mat-label>
        <input matInput [formControl]="q" [matAutocomplete]="auto" (keyup.enter)="go()">
        <mat-autocomplete #auto="matAutocomplete" (optionSelected)="go()">@for (s of suggestions(); track s) {<mat-option [value]="s">{{ s }}</mat-option>}</mat-autocomplete>
        <button mat-icon-button matSuffix (click)="go()"><mat-icon>search</mat-icon></button>
      </mat-form-field>
      <div class="row" style="gap:8px"><button mat-stroked-button style="color:#fff;border-color:#fff" (click)="locate()"><mat-icon>my_location</mat-icon> Restaurants near me</button></div>
    </div>
    @if (campaigns().length) { <h2>Campaigns</h2><div class="row">@for (c of campaigns(); track c.id) { <div class="card" style="background:#fef3c7"><b>{{ c.name }}</b><div class="muted">{{ c.bannerText || c.description }}</div></div> }</div> }
    @if (offers().length) { <h2>Offers for you</h2><div class="row">@for (o of offers(); track o.id) { <div class="card" style="border-left:4px solid #f97316"><span class="mono"><b>{{ o.code }}</b></span><div class="muted">{{ o.description }}</div><div class="muted">Min order {{ o.minOrderValue | money }}</div></div> }</div> }
    <h2>Cuisines</h2>
    <div class="row" style="gap:8px">@for (c of cuisines(); track c) {<a mat-stroked-button [routerLink]="['/customer/restaurants']" [queryParams]="{ cuisine: c }">{{ c }}</a>} @empty {<span class="muted">Cuisines appear when restaurants are approved</span>}</div>
    @if (nearby().length) { <h2>Near you</h2><div class="grid">@for (r of nearby(); track r.id) { <app-restaurant-card [restaurant]="r" /> }</div> }
    <h2>Top rated</h2>
    <div class="grid">@for (r of top(); track r.id) { <app-restaurant-card [restaurant]="r" /> } @empty { <div class="muted">No restaurants yet</div> }</div>
    @if (popular().length) { <h2>Popular dishes</h2><div class="grid-sm">@for (i of popular(); track i.id) { <a class="card" [routerLink]="['/customer/restaurants', i.restaurantId]" style="color:inherit;text-decoration:none"><b>{{ i.name }}</b><div class="muted">{{ i.basePrice | money }}</div></a> }</div> }
  </div>`
})
export class CustomerHomeComponent implements OnInit {
  private api = inject(CustomerApi); private router = inject(Router);
  q = new FormControl('', { nonNullable: true });
  suggestions = signal<string[]>([]); top = signal<Restaurant[]>([]); nearby = signal<Restaurant[]>([]); cuisines = signal<string[]>([]);
  offers = signal<any[]>([]); campaigns = signal<any[]>([]); popular = signal<MenuItem[]>([]);
  ngOnInit() {
    this.api.restaurants({ size: 8, sort: 'rating' }).subscribe(p => this.top.set(p.content));
    this.api.cuisines().subscribe(c => this.cuisines.set(c));
    this.api.offers().subscribe(o => this.offers.set(o.slice(0, 4)));
    this.api.campaigns().subscribe(c => this.campaigns.set(c));
    this.api.popular().subscribe(p => this.popular.set(p));
    this.q.valueChanges.pipe(debounceTime(250), distinctUntilChanged(), switchMap(v => (v && v.length > 1 ? this.api.suggest(v) : of([])))).subscribe(s => this.suggestions.set(s));
  }
  go() { this.router.navigate(['/customer/restaurants'], { queryParams: { q: this.q.value } }); }
  locate() {
    navigator.geolocation?.getCurrentPosition(
      p => this.api.nearby(p.coords.latitude, p.coords.longitude, 15).subscribe(r => this.nearby.set(r)),
      () => this.api.nearby(12.9716, 77.5946, 15).subscribe(r => this.nearby.set(r)));   // fallback: city centre
  }
}

@Component({
  selector: 'app-restaurants', imports: [UI, RestaurantCardComponent, PageHeaderComponent, EmptyComponent],
  template: `<div class="page"><app-page-header title="Restaurants" subtitle="Search, filter and sort approved restaurants" />
    <form [formGroup]="f" class="card row" style="margin-bottom:16px" (ngSubmit)="load(0)">
      <mat-form-field style="width:220px"><mat-label>Search</mat-label><input matInput formControlName="q"></mat-form-field>
      <mat-form-field style="width:170px"><mat-label>Cuisine</mat-label><mat-select formControlName="cuisine"><mat-option value="">Any</mat-option>@for (c of cuisines(); track c) {<mat-option [value]="c">{{ c }}</mat-option>}</mat-select></mat-form-field>
      <mat-form-field style="width:140px"><mat-label>Min rating</mat-label><mat-select formControlName="minRating"><mat-option value="">Any</mat-option><mat-option [value]="3">3+</mat-option><mat-option [value]="4">4+</mat-option></mat-select></mat-form-field>
      <mat-form-field style="width:150px"><mat-label>Sort by</mat-label><mat-select formControlName="sort"><mat-option value="rating">Rating</mat-option><mat-option value="delivery">Fastest</mat-option><mat-option value="name">Name</mat-option><mat-option value="newest">Newest</mat-option></mat-select></mat-form-field>
      <mat-checkbox formControlName="pureVeg">Pure veg</mat-checkbox><mat-checkbox formControlName="openNow">Open now</mat-checkbox>
      <button mat-flat-button color="primary">Apply</button>
    </form>
    <div class="grid">@for (r of list(); track r.id) { <app-restaurant-card [restaurant]="r" /> }</div>
    @if (!list().length) { <app-empty icon="storefront" text="No restaurants match your filters" /> }
    <mat-paginator [length]="total()" [pageSize]="12" [pageIndex]="page()" [hidePageSize]="true" (page)="load($event.pageIndex)" />
  </div>`
})
export class RestaurantsComponent implements OnInit {
  private api = inject(CustomerApi); private fb = inject(FormBuilder); private route = inject(ActivatedRoute);
  list = signal<Restaurant[]>([]); total = signal(0); page = signal(0); cuisines = signal<string[]>([]);
  f = this.fb.nonNullable.group({ q: [''], cuisine: [''], minRating: [''], sort: ['rating'], pureVeg: [false], openNow: [false] });
  ngOnInit() {
    this.api.cuisines().subscribe(c => this.cuisines.set(c));
    const qp = this.route.snapshot.queryParamMap;
    this.f.patchValue({ q: qp.get('q') ?? '', cuisine: qp.get('cuisine') ?? '' });
    this.load(0);
  }
  load(p: number) {
    const v = this.f.getRawValue();
    this.api.restaurants({ ...v, pureVeg: v.pureVeg || undefined, openNow: v.openNow || undefined, page: p, size: 12 }).subscribe(r => { this.list.set(r.content); this.total.set(r.totalElements); this.page.set(r.page); });
  }
}

// ----------------------------------------------------------------------------------------------------- item customisation dialog
@Component({
  selector: 'app-item-dialog', imports: [UI, MoneyPipe],
  template: `<h2 mat-dialog-title>{{ item.name }}</h2>
  <mat-dialog-content style="min-width:min(420px,80vw)">
    <p class="muted">{{ item.description }}</p>
    @if (item.variants.length) { <h3>Choose size *</h3>
      <mat-radio-group [(ngModel)]="variant" style="display:flex;flex-direction:column">@for (v of item.variants; track v.name) {<mat-radio-button [value]="v.name">{{ v.name }} @if (v.extraPrice) { (+{{ v.extraPrice | money }}) }</mat-radio-button>}</mat-radio-group> }
    @if (item.addOns.length) { <h3>Add-ons</h3>@for (a of item.addOns; track a.id) {<div><mat-checkbox [disabled]="!a.available" (change)="toggle(a.id!, $event.checked)">{{ a.name }} (+{{ a.price | money }})</mat-checkbox></div>} }
    <mat-form-field style="margin-top:12px"><mat-label>Special instructions</mat-label><input matInput [(ngModel)]="instructions" maxlength="300"></mat-form-field>
    <div class="row"><button mat-icon-button (click)="qty = qty > 1 ? qty - 1 : 1"><mat-icon>remove</mat-icon></button><b>{{ qty }}</b><button mat-icon-button (click)="qty = qty + 1"><mat-icon>add</mat-icon></button>
      <span class="right"><b>{{ total() | money }}</b></span></div>
  </mat-dialog-content>
  <mat-dialog-actions align="end"><button mat-button mat-dialog-close>Cancel</button>
    <button mat-flat-button color="primary" [disabled]="item.variants.length && !variant" [mat-dialog-close]="result()">Add to cart</button></mat-dialog-actions>`
})
export class ItemDialog {
  item = inject<MenuItem>(MAT_DIALOG_DATA);
  variant = ''; qty = 1; instructions = ''; private addOnIds = new Set<number>();
  toggle(id: number, on: boolean) { on ? this.addOnIds.add(id) : this.addOnIds.delete(id); }
  total() {
    const v = this.item.variants.find(x => x.name === this.variant)?.extraPrice ?? 0;
    const a = this.item.addOns.filter(x => this.addOnIds.has(x.id!)).reduce((s, x) => s + x.price, 0);
    return (this.item.basePrice + v + a) * this.qty;
  }
  result() { return { restaurantId: this.item.restaurantId, menuItemId: this.item.id, quantity: this.qty, variant: this.variant || undefined, addOnIds: [...this.addOnIds], instructions: this.instructions || undefined }; }
}

@Component({
  selector: 'app-restaurant-detail', imports: [UI, MoneyPipe, StarsComponent, EmptyComponent, DatePipeShim],
  template: `<div class="page">
    @if (r(); as r) {
      <div class="card row" style="gap:20px">
        <img class="dish-img" style="width:120px;height:120px" [src]="r.logoUrl || ''" alt="" onerror="this.style.visibility='hidden'">
        <div class="grow"><h1>{{ r.name }}</h1><div class="muted">{{ r.description }}</div>
          <div class="muted">{{ r.cuisines.join(' · ') }} · {{ r.addressLine }}, {{ r.city }}</div>
          <div class="row" style="gap:8px;margin-top:6px"><app-stars [value]="r.avgRating" /> <span>{{ r.avgRating }} ({{ r.ratingCount }} reviews)</span>
            <span class="chip" [class.green]="r.openNow" [class.red]="!r.openNow">{{ r.openNow ? 'Open now' : 'Closed' }}</span>
            <span class="muted">Min order {{ r.minOrderAmount | money }} · Delivery {{ r.deliveryFee | money }} · ~{{ r.prepTimeMinutes }} min</span></div></div>
      </div>
      @if (offers().length) { <div class="row" style="margin:12px 0">@for (o of offers(); track o.id) {<span class="chip amber">🏷 {{ o.code }}: {{ o.description }}</span>}</div> }
      <mat-tab-group>
        <mat-tab label="Menu">
          @if (menu(); as m) {
            @for (c of m.categories; track c.id) { @if (c.items.length) {
              <h2>{{ c.name }}</h2>
              <div class="grid">@for (i of c.items; track i.id) {
                <div class="card" style="display:flex;gap:12px">
                  @if (i.imageUrl) { <img class="dish-img" [src]="i.imageUrl" alt=""> }
                  <div class="grow"><div style="font-weight:600"><span [style.color]="i.vegetarian ? '#15803d' : '#b91c1c'">●</span> {{ i.name }}</div>
                    <div class="muted">{{ i.description }}</div>
                    <div class="row" style="margin-top:6px"><b>{{ i.basePrice | money }}</b>@if (i.variants.length) {<span class="muted">· {{ i.variants.length }} sizes</span>}
                      <button mat-stroked-button color="primary" class="right" [disabled]="!i.available || !r.openNow" (click)="add(i)">{{ i.available ? 'Add' : 'Unavailable' }}</button></div></div>
                </div> }</div> } }
            @if (!m.totalItems) { <app-empty icon="restaurant_menu" text="This restaurant has not published a menu yet" /> }
          }
        </mat-tab>
        <mat-tab label="Reviews ({{ summary()?.count ?? 0 }})">
          @if (summary(); as s) { <div class="card row" style="margin:12px 0"><div class="stat">{{ s.average }}</div><div>@for (k of ['5','4','3','2','1']; track k) {<div class="muted">{{ k }}★ — {{ s.distribution[k] ?? 0 }}</div>}</div></div> }
          @for (rv of reviews(); track rv.id) { <div class="card" style="margin-bottom:8px"><div class="row"><b>{{ rv.reviewerName }}</b><app-stars [value]="rv.restaurantRating" /><span class="muted right">{{ rv.createdAt | date: 'mediumDate' }}</span></div><div>{{ rv.comment }}</div>
            @for (ir of rv.itemRatings; track ir.menuItemId) { <span class="chip gray">{{ ir.itemName }} {{ ir.rating }}★</span> }</div> }
          @if (!reviews().length) { <app-empty icon="rate_review" text="No reviews yet" /> }
        </mat-tab>
        <mat-tab label="Info"><div class="card" style="margin-top:12px"><p>📍 {{ r.addressLine }}, {{ r.city }} {{ r.postalCode }}</p><p>📞 {{ r.phone }}</p>
          <h3>Opening hours</h3>@for (h of r.hours; track h.dayOfWeek) {<div>{{ h.dayOfWeek }}: {{ h.closed ? 'Closed' : h.opensAt?.slice(0, 5) + ' – ' + h.closesAt?.slice(0, 5) }}</div>} @if (!r.hours.length) {<div>Open every day</div>}</div></mat-tab>
      </mat-tab-group>
    }
  </div>`
})
export class RestaurantDetailComponent implements OnInit {
  private api = inject(CustomerApi); private route = inject(ActivatedRoute); private dialog = inject(MatDialog); private snack = inject(MatSnackBar); private dlg = inject(Dialogs);
  r = signal<Restaurant | null>(null); menu = signal<Menu | null>(null); reviews = signal<Review[]>([]); summary = signal<Summary | null>(null); offers = signal<any[]>([]);
  ngOnInit() {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.api.restaurant(id).subscribe(r => this.r.set(r));
    this.api.menu(id).subscribe(m => this.menu.set(m));
    this.api.reviews(id).subscribe(p => this.reviews.set(p.content));
    this.api.reviewSummary(id).subscribe(s => this.summary.set(s));
    this.api.offers(id).subscribe(o => this.offers.set(o));
  }
  add(item: MenuItem) {
    this.dialog.open(ItemDialog, { data: item, maxWidth: '95vw' }).afterClosed().subscribe(body => {
      if (!body) return;
      this.api.addToCart(body).subscribe({
        next: () => this.snack.open(`${item.name} added to cart`, 'View cart', { duration: 3000 }),
        error: e => {
          if (e.status === 409 && String(e.error?.message).includes('CART_OTHER_RESTAURANT')) {
            this.dlg.confirm('Start a new cart?', 'Your cart has items from another restaurant. Replace it?', { confirmText: 'Replace cart', danger: true })
              .subscribe(ok => ok && this.api.addToCart(body, true).subscribe(() => this.snack.open('Cart replaced', undefined, { duration: 2500 })));
          }
        }
      });
    });
  }
}
import { DatePipe as DatePipeShim } from '@angular/common';
