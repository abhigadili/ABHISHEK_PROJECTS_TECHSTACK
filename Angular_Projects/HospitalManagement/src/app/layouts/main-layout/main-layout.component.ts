import { BreakpointObserver } from '@angular/cdk/layout';
import { ChangeDetectionStrategy, Component, computed, inject, signal, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatBadgeModule } from '@angular/material/badge';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSidenav, MatSidenavModule } from '@angular/material/sidenav';
import { MatTooltipModule } from '@angular/material/tooltip';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map, startWith } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { NAV_ITEMS, type NavItem } from '../../core/configuration/app-config';
import { LoadingService } from '../../core/services/loading.service';
import { NavigationEventsService } from '../../core/services/navigation-events.service';
import { NotificationCenterService } from '../../core/services/notification-center.service';
import { ThemeService } from '../../core/services/theme.service';
import { EventBusService } from '../../core/services/event-bus.service';
import { BreadcrumbsComponent } from './breadcrumbs.component';
import { avatarUri } from '../../shared/utilities/helpers';

/**
 * Main (authenticated) layout: Angular Material navigation (sidenav + toolbar + menu), responsive via CDK BreakpointObserver.
 * Contains the PRIMARY router-outlet and the NAMED outlet `quick` (auxiliary route: patient quick-view panel).
 */
@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, MatSidenavModule, MatIconModule, MatButtonModule, MatMenuModule, MatBadgeModule, MatDividerModule, MatTooltipModule, MatProgressBarModule, BreadcrumbsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mat-sidenav-container class="h-screen">
      <mat-sidenav #nav [mode]="mobile() ? 'over' : 'side'" [opened]="!mobile()" class="w-64 !bg-[#0f2744] !text-slate-200" aria-label="Primary navigation">
        <div class="flex h-14 items-center gap-2 border-b border-white/10 px-4"><span class="rounded-lg bg-brand-600 p-1 text-white"><mat-icon>add_box</mat-icon></span><span class="font-bold tracking-wide text-white">Hospital<span class="text-sky-300">Care</span></span></div>
        <nav class="overflow-y-auto px-2 py-3">
          @for (g of groups(); track g.name) {
            <div class="px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-widest opacity-50">{{ g.name }}</div>
            @for (i of g.items; track i.path) {
              <a [routerLink]="i.path" routerLinkActive="!bg-brand-600 !text-white" (click)="mobile() && nav.close()" class="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-slate-200 no-underline hover:bg-white/10">
                <mat-icon class="!h-5 !w-5 !text-[20px]">{{ i.icon }}</mat-icon>{{ i.label }}
              </a>
            }
          }
        </nav>
      </mat-sidenav>
      <mat-sidenav-content class="!flex !flex-col">
        <header class="no-print sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-slate-200 bg-white/90 px-3 backdrop-blur dark:border-slate-700 dark:bg-slate-900/90">
          @if (mobile()) { <button mat-icon-button aria-label="Open navigation" (click)="nav.toggle()"><mat-icon>menu</mat-icon></button> }
          <span class="flex-1 text-sm text-slate-500" aria-live="polite">{{ activity() }}</span>
          <button mat-icon-button (click)="theme.toggle()" [matTooltip]="theme.mode() === 'dark' ? 'Light mode' : 'Dark mode'" [attr.aria-label]="'Switch to ' + (theme.mode() === 'dark' ? 'light' : 'dark') + ' mode'"><mat-icon>{{ theme.mode() === 'dark' ? 'light_mode' : 'dark_mode' }}</mat-icon></button>
          <button mat-icon-button routerLink="/notifications" [attr.aria-label]="'Notifications (' + center.unreadCount() + ' unread)'" matTooltip="Notifications">
            <mat-icon [matBadge]="center.unreadCount() || null" matBadgeColor="warn" matBadgeSize="small">notifications</mat-icon>
          </button>
          <button mat-button [matMenuTriggerFor]="userMenu" class="!px-2" aria-label="User menu">
            <img [src]="avatar()" alt="" width="28" height="28" loading="lazy" class="mr-2 rounded-full" />
            <span class="hidden text-left text-xs leading-tight sm:inline"><span class="block font-semibold">{{ auth.user()?.username }}</span><span class="block text-slate-500">{{ roleLabel() }}</span></span>
          </button>
          <mat-menu #userMenu="matMenu">
            <div class="px-4 py-2 text-xs text-slate-500">{{ auth.user()?.email }}</div>
            <a mat-menu-item routerLink="/profile"><mat-icon>person</mat-icon> My profile</a>
            <a mat-menu-item routerLink="/notifications"><mat-icon>notifications</mat-icon> Notifications</a>
            <mat-divider />
            <button mat-menu-item (click)="signOut()"><mat-icon>logout</mat-icon> Sign out</button>
          </mat-menu>
        </header>
        @if (busy()) { <mat-progress-bar mode="indeterminate" class="!absolute !left-0 !right-0 !top-14 !z-30 !h-[3px]" aria-label="Loading" /> }
        <div class="flex min-h-0 flex-1">
          <main class="min-w-0 flex-1 overflow-y-auto p-4 sm:p-6" id="main">
            <app-breadcrumbs />
            <router-outlet />
          </main>
          <!-- NAMED outlet (auxiliary route): /patients(quick:quick-view/3) renders the patient quick view here -->
          @if (quickOpen()) { <aside class="no-print hidden w-80 shrink-0 overflow-y-auto border-l border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900 xl:block"><router-outlet name="quick" /></aside> } @else { <router-outlet name="quick" /> }
        </div>
      </mat-sidenav-content>
    </mat-sidenav-container>
  `,
})
export class MainLayoutComponent {
  protected readonly auth = inject(AuthService);
  protected readonly theme = inject(ThemeService);
  protected readonly center = inject(NotificationCenterService);
  private readonly items = inject(NAV_ITEMS); // multi-provider: NavItem[]
  private readonly router = inject(Router);
  /** The aside is only rendered while the auxiliary `quick` route is active (e.g. /patients(quick:quick-view/3)). */
  protected readonly quickOpen = toSignal(this.router.events.pipe(filter((e) => e instanceof NavigationEnd), startWith(null), map(() => this.router.url.includes('quick:'))), { initialValue: false });
  private readonly loading = inject(LoadingService);
  private readonly nav = inject(NavigationEventsService);
  private readonly bus = inject(EventBusService);
  protected readonly sidenav = viewChild.required<MatSidenav>('nav');

  protected readonly mobile = toSignal(inject(BreakpointObserver).observe('(max-width: 1023px)').pipe(map((r) => r.matches)), { initialValue: false });
  protected readonly busy = computed(() => this.loading.isLoading() || this.nav.navigating());
  protected readonly avatar = computed(() => avatarUri(this.auth.user()?.username ?? '?', 56));
  protected readonly roleLabel = computed(() => (this.auth.role() ?? '').toLowerCase().replace('_', ' '));
  /** BehaviorSubject (shared application state) → signal: shows the latest application event in the header. */
  protected readonly activity = toSignal(this.bus.lastActivity$, { initialValue: '' });

  protected readonly groups = computed(() => {
    const visible = this.items.filter((i: NavItem) => !i.permission || this.auth.can(i.permission));
    const order: NavItem['group'][] = ['Care', 'Clinical', 'Operations', 'Administration'];
    return order.map((name) => ({ name, items: visible.filter((i) => i.group === name) })).filter((g) => g.items.length > 0);
  });

  protected signOut() {
    this.auth.logout('logout').subscribe();
    void this.router.navigate(['/auth/login']);
  }
}
