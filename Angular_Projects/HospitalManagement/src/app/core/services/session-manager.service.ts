import { DOCUMENT } from '@angular/common';
import { Injectable, effect, inject, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { APP_CONFIG } from '../configuration/app-config';
import { NotificationService } from './notification.service';

/**
 * Session management: proactive token renewal 60 s before expiry and automatic logout after inactivity.
 * Implemented with effect() and its cleanup callback (`onCleanup`) – timers/listeners are removed whenever the
 * authentication state changes, so no timer outlives a session.
 */
@Injectable({ providedIn: 'root' })
export class SessionManagerService {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly notify = inject(NotificationService);
  private readonly doc = inject(DOCUMENT);
  private readonly cfg = inject(APP_CONFIG);

  constructor() {
    effect((onCleanup) => {
      if (!this.auth.isAuthenticated()) return;
      // untracked(): reading config/expiry here must not make the effect depend on anything but `isAuthenticated`
      untracked(() => {
        let renewTimer: ReturnType<typeof setTimeout>;
        const arm = () => {
          renewTimer = setTimeout(() => this.auth.refresh().subscribe({ next: arm, error: () => this.expired() }), this.auth.msUntilRenewal());
        };
        arm();

        let last = Date.now();
        const bump = () => (last = Date.now());
        const events = ['mousemove', 'keydown', 'click', 'touchstart'] as const;
        events.forEach((e) => this.doc.addEventListener(e, bump, { passive: true }));
        const idleTimer = setInterval(() => {
          if (Date.now() - last >= this.cfg.idleLogoutMinutes * 60_000) {
            this.notify.info('You were signed out after a period of inactivity.');
            this.auth.logout('idle').subscribe();
            void this.router.navigate(['/auth/login']);
          }
        }, 15_000);

        onCleanup(() => {
          clearTimeout(renewTimer);
          clearInterval(idleTimer);
          events.forEach((e) => this.doc.removeEventListener(e, bump));
        });
      });
    });

    this.auth.sessionEnded$.subscribe((reason) => {
      if (reason === 'expired') {
        this.notify.error('Your session has expired. Please sign in again.', 'session-expired');
        void this.router.navigate(['/auth/login']);
      }
    });
  }
  private expired() { /* refresh failure already ended the session (AuthService) */ }
}
