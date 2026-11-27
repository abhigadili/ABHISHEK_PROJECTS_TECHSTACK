import { BreakpointObserver } from '@angular/cdk/layout';
import { ChangeDetectionStrategy, Component, computed, effect, inject, viewChild } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSidenav, MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { catchError, map, of, switchMap } from 'rxjs';
import { AuthService } from '../core/services/auth.service';
import { BreadcrumbService } from '../core/services/breadcrumb.service';
import { ConnectivityService } from '../core/services/connectivity.service';
import { LoadingService } from '../core/services/loading.service';
import { NotificationService } from '../core/services/notification.service';
import { PermissionService } from '../core/services/permission.service';
import { PictureService } from '../core/services/picture.service';
import { PreferencesService } from '../core/services/preferences.service';
import { ProfileService } from '../core/services/profile.service';
import { ProfilePictureComponent } from '../shared/components/profile-picture.component';
import { NAV_ITEMS } from './nav-items';
import { NotificationMenuComponent } from './notification-menu.component';

/** Application frame: responsive sidenav, toolbar with breadcrumbs, notification bell and user menu. */
@Component({
  selector: 'app-shell',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterOutlet, RouterLink, RouterLinkActive, MatSidenavModule, MatToolbarModule, MatListModule, MatIconModule, MatButtonModule,
    MatMenuModule, MatBadgeModule, MatDividerModule, MatProgressBarModule, ProfilePictureComponent, NotificationMenuComponent,
  ],
  template: `
    <mat-sidenav-container class="shell">
      <mat-sidenav #nav [mode]="isHandset() ? 'over' : 'side'" [opened]="!isHandset() && !collapsed()" class="sidenav" role="navigation">
        <div class="brand"><mat-icon>apartment</mat-icon><span>EMS</span></div>
        <mat-nav-list>
          @for (item of items(); track item.route) {
            <a mat-list-item [routerLink]="item.route" routerLinkActive="active" #rla="routerLinkActive" [activated]="rla.isActive" (click)="closeIfHandset()" [attr.data-testid]="'nav-' + item.label.toLowerCase().replaceAll(' ', '-')">
              <mat-icon matListItemIcon>{{ item.icon }}</mat-icon>
              <span matListItemTitle>{{ item.label }}</span>
            </a>
          }
        </mat-nav-list>
      </mat-sidenav>

      <mat-sidenav-content>
        <mat-toolbar class="toolbar">
          <button mat-icon-button type="button" aria-label="Toggle navigation" (click)="toggle()" data-testid="nav-toggle"><mat-icon>menu</mat-icon></button>
          <nav class="crumbs" aria-label="Breadcrumb">
            @for (c of crumbs(); track c.url; let last = $last) {
              @if (last) {
                <span aria-current="page">{{ c.label }}</span>
              } @else {
                <a [routerLink]="c.url">{{ c.label }}</a>
                <mat-icon class="sep">chevron_right</mat-icon>
              }
            }
          </nav>
          <span class="spacer"></span>

          <button mat-icon-button type="button" [matMenuTriggerFor]="notifMenu" aria-label="Notifications" data-testid="notification-bell">
            <mat-icon [matBadge]="unread() || null" matBadgeSize="small" matBadgeColor="warn" [matBadgeHidden]="unread() === 0">notifications</mat-icon>
          </button>
          <mat-menu #notifMenu="matMenu" class="notif-panel">
            <ng-template matMenuContent><app-notification-menu (click)="$event.stopPropagation()" /></ng-template>
          </mat-menu>

          <button mat-button type="button" [matMenuTriggerFor]="userMenu" class="user-btn" data-testid="user-menu">
            <app-profile-picture [employeeId]="auth.employeeId()" [hasPicture]="hasPicture()" [name]="shownName()" [size]="32" />
            <span class="uname">{{ shownName() }}</span>
            <mat-icon>arrow_drop_down</mat-icon>
          </button>
          <mat-menu #userMenu="matMenu">
            <div class="menu-head"><strong>{{ shownName() }}</strong><small>{{ auth.user()?.email }}</small><small class="role">{{ auth.role() }}</small></div>
            <mat-divider />
            <a mat-menu-item routerLink="/profile"><mat-icon>person</mat-icon> My profile</a>
            <a mat-menu-item routerLink="/profile/change-password"><mat-icon>lock</mat-icon> Change password</a>
            <a mat-menu-item routerLink="/settings"><mat-icon>settings</mat-icon> Settings</a>
            <button mat-menu-item type="button" (click)="auth.logout()" data-testid="logout"><mat-icon>logout</mat-icon> Sign out</button>
          </mat-menu>
        </mat-toolbar>
        @if (!online()) {
          <div class="offline" role="alert" data-testid="offline-banner"><mat-icon>cloud_off</mat-icon> You are offline — changes cannot be saved until the connection is back.</div>
        }
        @if (loading.isLoading()) {
          <mat-progress-bar mode="indeterminate" class="progress" />
        }
        <main class="content"><router-outlet /></main>
      </mat-sidenav-content>
    </mat-sidenav-container>
  `,
  styles: `
    .shell { height: 100vh; }
    .sidenav { width: 248px; background: var(--ems-surface); }
    .brand { display: flex; align-items: center; gap: 10px; padding: 18px 20px; font-size: 1.25rem; font-weight: 600; color: var(--ems-primary); }
    .toolbar { position: sticky; top: 0; z-index: 5; background: var(--ems-surface); border-bottom: 1px solid var(--ems-border); gap: 4px; }
    .crumbs { display: flex; align-items: center; font-size: 14px; margin-left: 8px; min-width: 0; overflow: hidden; white-space: nowrap; }
    .crumbs a { text-decoration: none; color: var(--ems-muted); }
    .crumbs span[aria-current] { font-weight: 500; }
    .sep { color: var(--ems-muted); }
    .spacer { flex: 1; }
    .offline { display: flex; gap: 8px; align-items: center; background: #b3261e; color: #fff; padding: 8px 16px; font-size: 14px; }
    .progress { position: sticky; top: 64px; z-index: 6; }
    .content { min-height: calc(100vh - 64px); }
    .user-btn { display: flex; align-items: center; gap: 6px; }
    .menu-head { display: flex; flex-direction: column; padding: 8px 16px; }
    .menu-head small { color: var(--ems-muted); }
    .menu-head .role { font-size: 11px; letter-spacing: 0.5px; }
    .active { background: var(--ems-primary-container); }
    @media (max-width: 700px) { .uname { display: none; } .crumbs { display: none; } }
  `,
})
export class ShellComponent {
  protected readonly auth = inject(AuthService);
  protected readonly loading = inject(LoadingService);
  private readonly permissions = inject(PermissionService);
  private readonly prefs = inject(PreferencesService);
  protected readonly crumbs = inject(BreadcrumbService).crumbs;
  protected readonly unread = inject(NotificationService).unreadCount;

  protected readonly online = toSignal(inject(ConnectivityService).online$, { initialValue: true });
  private readonly profiles = inject(ProfileService);
  private readonly pictures = inject(PictureService);
  /** Own profile (for the avatar flag); reloads when the picture is changed anywhere in the app. */
  private readonly me = toSignal(
    toObservable(computed(() => ({ e: this.auth.employeeId(), v: this.pictures.version() }))).pipe(
      switchMap(({ e }) => (e ? this.profiles.get().pipe(catchError(() => of(null))) : of(null))),
    ),
    { initialValue: null },
  );
  protected readonly hasPicture = computed(() => !!this.me()?.profilePictureUrl);
  protected readonly shownName = computed(() => this.prefs.prefs().displayName.trim() || this.auth.displayName());

  protected readonly isHandset = toSignal(inject(BreakpointObserver).observe('(max-width: 900px)').pipe(map((r) => r.matches)), { initialValue: false });
  protected readonly collapsed = computed(() => this.prefs.prefs().sidebarCollapsed);
  private readonly sidenav = viewChild.required<MatSidenav>('nav');

  /** Nav entries filtered by what this role may use — recomputed only when permissions change. */
  protected readonly items = computed(() => NAV_ITEMS.filter((i) => !i.permissions || this.permissions.hasAny(i.permissions)));

  constructor() {
    effect(() => {
      // side-effect: sync the drawer with the persisted preference on desktop
      const nav = this.sidenav();
      if (!this.isHandset()) void (this.collapsed() ? nav.close() : nav.open());
    });
  }

  protected toggle(): void {
    if (this.isHandset()) void this.sidenav().toggle();
    else this.prefs.update({ sidebarCollapsed: !this.collapsed() });
  }

  protected closeIfHandset(): void {
    if (this.isHandset()) void this.sidenav().close();
  }
}
