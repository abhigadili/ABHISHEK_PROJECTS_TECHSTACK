import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { BreakpointObserver } from '@angular/cdk/layout';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { map } from 'rxjs';
import { AuthService } from '../core/auth/auth.service';
import type { NavLink } from '../core/config/tokens';
import { ROLE_LABEL } from '../core/auth/permissions';
import { NotificationBellComponent } from './notification-bell.component';

/** Shared side-navigation shell for the passenger and admin areas (links arrive through the NAV_LINKS multi-provider). */
@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, MatSidenavModule, MatToolbarModule, MatButtonModule, MatIconModule, MatMenuModule, NotificationBellComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mat-sidenav-container class="sc">
      <mat-sidenav [mode]="mobile() ? 'over' : 'side'" [opened]="!mobile() || open()" (closedStart)="open.set(false)" class="sn" role="navigation" aria-label="Section navigation">
        <div class="logo"><mat-icon>train</mat-icon> {{ heading() }}</div>
        <nav class="nav">
          @for (l of visible(); track l.path) {
            <a [routerLink]="l.path" routerLinkActive="act" (click)="mobile() && open.set(false)"><mat-icon aria-hidden="true">{{ l.icon }}</mat-icon><span>{{ l.label }}</span></a>
          }
        </nav>
        <div class="foot"><a routerLink="/" class="muted"><mat-icon>search</mat-icon> Search trains</a></div>
      </mat-sidenav>
      <mat-sidenav-content>
        <mat-toolbar class="tb">
          @if (mobile()) { <button mat-icon-button (click)="open.set(!open())" aria-label="Toggle navigation"><mat-icon>menu</mat-icon></button> }
          <span class="spacer"></span>
          <app-notification-bell />
          <button mat-button [matMenuTriggerFor]="um"><mat-icon>account_circle</mat-icon> {{ auth.displayName() }}</button>
          <mat-menu #um="matMenu">
            <div class="roles muted">{{ roleText() }}</div>
            <a mat-menu-item routerLink="/app/profile"><mat-icon>person</mat-icon>Profile</a>
            <button mat-menu-item (click)="auth.logout().subscribe()"><mat-icon>logout</mat-icon>Sign out</button>
          </mat-menu>
        </mat-toolbar>
        <main id="main" tabindex="-1" class="container"><router-outlet /></main>
      </mat-sidenav-content>
    </mat-sidenav-container>`,
  styles: [`.sc{min-height:100vh;background:var(--c-bg)}.sn{width:250px;background:var(--c-surface);border-right:1px solid var(--c-border)}.logo{display:flex;gap:8px;align-items:center;font-weight:800;font-size:1.1rem;padding:18px 16px;color:var(--c-primary)}
    .nav{display:flex;flex-direction:column;padding:0 8px}.nav a{display:flex;gap:12px;align-items:center;padding:10px 12px;border-radius:10px;text-decoration:none;color:var(--c-text)}.nav a:hover{background:var(--c-surface-2)}.nav .act{background:var(--c-primary);color:#fff}
    .foot{padding:16px}.foot a{display:flex;gap:8px;align-items:center;text-decoration:none}.tb{background:var(--c-surface);border-bottom:1px solid var(--c-border);position:sticky;top:0;z-index:40}.spacer{flex:1}.roles{padding:8px 16px;font-size:.8rem}`],
})
export class ShellComponent {
  readonly auth = inject(AuthService);
  readonly links = input.required<NavLink[]>();
  readonly heading = input('RailBook');
  readonly open = signal(false);
  readonly mobile = toSignal(inject(BreakpointObserver).observe('(max-width: 900px)').pipe(map((s) => s.matches)), { initialValue: false });
  readonly visible = computed(() => this.links().filter((l) => !l.permission || this.auth.can(l.permission as never)));
  readonly roleText = computed(() => this.auth.roles().map((r) => ROLE_LABEL[r]).join(' · '));
}
