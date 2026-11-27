import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatToolbarModule } from '@angular/material/toolbar';
import { AuthService } from '../../core/auth/auth.service';
import { NotificationBellComponent } from '../notification-bell.component';

/** Public shell: marketing / search area with a top toolbar (also used by signed-in users browsing trains). */
@Component({
  selector: 'app-main-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, MatToolbarModule, MatButtonModule, MatIconModule, MatMenuModule, NotificationBellComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mat-toolbar class="tb">
      <a routerLink="/" class="brand" aria-label="Train Ticket Booking home"><mat-icon>train</mat-icon><span>RailBook</span></a>
      <nav class="links" aria-label="Main">
        <a mat-button routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }">Search</a>
        <a mat-button routerLink="/trains" routerLinkActive="active">Trains</a>
        <a mat-button routerLink="/stations" routerLinkActive="active">Stations</a>
        @if (auth.isAuthenticated()) { <a mat-button routerLink="/pnr" routerLinkActive="active">PNR status</a> }
      </nav>
      <span class="spacer"></span>
      @if (auth.isAuthenticated()) {
        <app-notification-bell />
        <button mat-button [matMenuTriggerFor]="um"><mat-icon>account_circle</mat-icon><span class="nm">{{ auth.displayName() }}</span></button>
        <mat-menu #um="matMenu">
          <a mat-menu-item routerLink="/app/dashboard"><mat-icon>dashboard</mat-icon>My account</a>
          @if (auth.isBackOffice()) { <a mat-menu-item routerLink="/admin"><mat-icon>admin_panel_settings</mat-icon>Back office</a> }
          <button mat-menu-item (click)="logout()"><mat-icon>logout</mat-icon>Sign out</button>
        </mat-menu>
      } @else {
        <a mat-button routerLink="/auth/login">Sign in</a>
        <a mat-flat-button routerLink="/auth/register">Register</a>
      }
    </mat-toolbar>
    <main id="main" tabindex="-1"><router-outlet /></main>
    <footer class="ft"><span class="muted">© RailBook — tickets are booked and paid through the Train Ticket Booking API.</span></footer>`,
  styles: [`.tb{position:sticky;top:0;z-index:50;background:var(--c-primary);color:#fff;gap:4px}.tb a,.tb button{color:#fff}.brand{display:flex;align-items:center;gap:8px;font-weight:800;font-size:1.2rem;text-decoration:none;margin-right:12px}
    .links{display:flex;gap:2px}.links .active{background:rgba(255,255,255,.18)}.spacer{flex:1}.nm{margin-left:6px}.ft{padding:24px 16px;text-align:center;border-top:1px solid var(--c-border)}
    @media (max-width:760px){.links{display:none}.nm{display:none}}`],
})
export class MainLayoutComponent {
  readonly auth = inject(AuthService);
  logout() { this.auth.logout().subscribe(); }
}
