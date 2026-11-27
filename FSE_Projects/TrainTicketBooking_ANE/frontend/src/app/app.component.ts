import { ChangeDetectionStrategy, Component, effect, inject } from '@angular/core';
import { NavigationCancel, NavigationEnd, NavigationError, NavigationStart, Router, RouterOutlet } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { Store } from '@ngrx/store';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { AuthService } from './core/auth/auth.service';
import { GlobalProgressComponent } from './shared/components/ui.components';
import { NotificationActions } from './store/notifications/notifications.store';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, GlobalProgressComponent, MatProgressBarModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a class="skip-link" href="#main">Skip to main content</a>
    <app-global-progress />
    @if (navigating()) { <mat-progress-bar mode="indeterminate" class="nav-progress" aria-label="Loading page" /> }
    <router-outlet />`,
  styles: [`.nav-progress{position:fixed;top:0;left:0;right:0;z-index:2100;height:3px}`],
})
export class AppComponent {
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly store = inject(Store);
  /** Router events -> signal: true between NavigationStart and the end/cancel/error of a (lazy / resolver) navigation. */
  readonly navigating = toSignal(this.router.events.pipe(
    filter((e) => e instanceof NavigationStart || e instanceof NavigationEnd || e instanceof NavigationCancel || e instanceof NavigationError),
    map((e) => e instanceof NavigationStart),
  ), { initialValue: false });

  constructor() {
    // effect(): keep notification polling in sync with the authentication state
    effect(() => this.store.dispatch(this.auth.isAuthenticated() ? NotificationActions.startPolling() : NotificationActions.stopPolling()));
  }
}
