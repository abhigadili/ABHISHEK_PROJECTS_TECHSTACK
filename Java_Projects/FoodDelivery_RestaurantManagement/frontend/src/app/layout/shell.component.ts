import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatListModule } from '@angular/material/list';
import { AuthService } from '../core/auth/auth.service';
import { CustomerApi } from '../core/services/customer-api';
import { UI } from '../shared/material';
import { Subscription, interval, startWith, switchMap, catchError, of } from 'rxjs';
import { BreakpointObserver } from '@angular/cdk/layout';

interface NavItem { label: string; icon: string; link: string; }

/** Application shell: toolbar, role-based navigation, notification bell (polls unread count) and cart badge. */
@Component({
  selector: 'app-shell',
  imports: [UI, RouterOutlet, MatSidenavModule, MatToolbarModule, MatListModule],
  template: `
  <mat-sidenav-container style="height:100vh">
    <mat-sidenav #nav [mode]="mobile() ? 'over' : 'side'" [opened]="!mobile()" style="width:240px">
      <div style="padding:16px 16px 8px"><span style="font-size:20px;font-weight:700;color:#c2410c">🍽 FoodDelivery</span><div class="muted">{{ roleLabel() }}</div></div>
      <mat-nav-list>
        @for (n of items(); track n.link) {
          <a mat-list-item [routerLink]="n.link" routerLinkActive="active-link" (click)="mobile() && nav.close()"><mat-icon matListItemIcon>{{ n.icon }}</mat-icon><span matListItemTitle>{{ n.label }}</span></a>
        }
      </mat-nav-list>
    </mat-sidenav>
    <mat-sidenav-content>
      <mat-toolbar style="position:sticky;top:0;z-index:5;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.12)">
        @if (mobile()) { <button mat-icon-button (click)="nav.toggle()"><mat-icon>menu</mat-icon></button> }
        <span class="grow"></span>
        @if (auth.hasRole('CUSTOMER')) {
          <a mat-icon-button routerLink="/customer/cart" matTooltip="Cart"><mat-icon [matBadge]="cartCount() || null" matBadgeColor="warn">shopping_cart</mat-icon></a>
        }
        <a mat-icon-button [routerLink]="notifLink()" matTooltip="Notifications"><mat-icon [matBadge]="unread() || null" matBadgeColor="warn">notifications</mat-icon></a>
        <button mat-button [matMenuTriggerFor]="menu"><mat-icon>account_circle</mat-icon> {{ auth.user()?.username }}</button>
        <mat-menu #menu="matMenu">
          <div style="padding:8px 16px" class="muted">{{ auth.user()?.email }}</div>
          <button mat-menu-item (click)="goProfile()"><mat-icon>person</mat-icon> Profile</button>
          <button mat-menu-item (click)="auth.logout()"><mat-icon>logout</mat-icon> Sign out</button>
        </mat-menu>
      </mat-toolbar>
      <router-outlet />
    </mat-sidenav-content>
  </mat-sidenav-container>`,
  styles: [`.active-link { background: #fff1e6 !important; font-weight: 600; }`]
})
export class ShellComponent implements OnInit, OnDestroy {
  auth = inject(AuthService);
  private api = inject(CustomerApi);
  private router = inject(Router);
  private sub?: Subscription;
  unread = signal(0);
  cartCount = signal(0);
  mobile = signal(false);

  items = computed<NavItem[]>(() => {
    const a = this.auth;
    if (a.hasRole('ADMIN', 'SUPER_ADMIN')) return [
      { label: 'Dashboard', icon: 'dashboard', link: '/admin/dashboard' }, { label: 'Users', icon: 'group', link: '/admin/users' },
      { label: 'Restaurants', icon: 'storefront', link: '/admin/restaurants' }, { label: 'Orders', icon: 'receipt_long', link: '/admin/orders' },
      { label: 'Payments', icon: 'payments', link: '/admin/payments' }, { label: 'Refunds', icon: 'currency_exchange', link: '/admin/refunds' },
      { label: 'Delivery', icon: 'delivery_dining', link: '/admin/delivery' }, { label: 'Coupons', icon: 'sell', link: '/admin/coupons' },
      { label: 'Review moderation', icon: 'rate_review', link: '/admin/reviews' }, { label: 'Inventory', icon: 'inventory_2', link: '/admin/inventory' },
      { label: 'System & activity', icon: 'settings', link: '/admin/system' },
      { label: 'Kafka: Topics', icon: 'hub', link: '/kafka/topics' }, { label: 'Kafka: Messages', icon: 'mail', link: '/kafka/audit' },
      { label: 'Kafka: Event flow', icon: 'account_tree', link: '/kafka/flow' }, { label: 'Kafka: Consumer groups', icon: 'groups', link: '/kafka/groups' },
      { label: 'Kafka: Failed & DLT', icon: 'error', link: '/kafka/failed' },
      { label: 'Observability', icon: 'monitor_heart', link: '/logs/health' }, { label: 'Log search', icon: 'manage_search', link: '/logs/search' }
    ];
    if (a.hasRole('RESTAURANT_OWNER', 'RESTAURANT_STAFF')) return [
      { label: 'Dashboard', icon: 'dashboard', link: '/owner/dashboard' }, { label: 'Restaurant', icon: 'storefront', link: '/owner/restaurant' },
      { label: 'Menu', icon: 'restaurant_menu', link: '/owner/menu' }, { label: 'Orders', icon: 'receipt_long', link: '/owner/orders' },
      { label: 'Inventory', icon: 'inventory_2', link: '/owner/inventory' }, { label: 'Reviews', icon: 'star', link: '/owner/reviews' }
    ];
    if (a.hasRole('DELIVERY_PARTNER')) return [
      { label: 'Deliveries', icon: 'delivery_dining', link: '/delivery/dashboard' }, { label: 'History', icon: 'history', link: '/delivery/history' },
      { label: 'Profile & performance', icon: 'person', link: '/delivery/profile' }
    ];
    return [
      { label: 'Home', icon: 'home', link: '/customer/home' }, { label: 'Restaurants', icon: 'storefront', link: '/customer/restaurants' },
      { label: 'My orders', icon: 'receipt_long', link: '/customer/orders' }, { label: 'Addresses', icon: 'place', link: '/customer/addresses' },
      { label: 'Payment methods', icon: 'credit_card', link: '/customer/payment-methods' }, { label: 'Profile', icon: 'person', link: '/customer/profile' }
    ];
  });
  roleLabel = computed(() => (this.auth.roles()[0] ?? '').replace(/_/g, ' ').toLowerCase());
  notifLink = computed(() => this.auth.hasRole('ADMIN', 'SUPER_ADMIN') ? '/admin/notifications' : this.auth.hasRole('RESTAURANT_OWNER') ? '/owner/notifications'
    : this.auth.hasRole('DELIVERY_PARTNER') ? '/delivery/notifications' : '/customer/notifications');

  constructor() { inject(BreakpointObserver).observe('(max-width: 900px)').subscribe(r => this.mobile.set(r.matches)); }

  ngOnInit() {
    this.sub = interval(20000).pipe(startWith(0), switchMap(() => this.api.unread().pipe(catchError(() => of({ unread: 0 }))))).subscribe(r => this.unread.set(r.unread));
    if (this.auth.hasRole('CUSTOMER')) {
      this.sub.add(interval(15000).pipe(startWith(0), switchMap(() => this.api.cart().pipe(catchError(() => of(null))))).subscribe(c => this.cartCount.set(c ? c.lines.reduce((n, l) => n + l.quantity, 0) : 0)));
    }
  }
  ngOnDestroy() { this.sub?.unsubscribe(); }
  goProfile() { this.router.navigateByUrl(this.auth.hasRole('CUSTOMER') ? '/customer/profile' : this.auth.hasRole('DELIVERY_PARTNER') ? '/delivery/profile' : this.auth.homeFor()); }
}
