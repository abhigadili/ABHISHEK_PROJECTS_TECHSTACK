import { Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationCancel, NavigationEnd, NavigationError, NavigationStart, Router, RoutesRecognized } from '@angular/router';
import { filter, map, pairwise, startWith } from 'rxjs';
import { LoggingService } from './logging.service';

/** Navigation events: drives the top progress bar and logs navigation timing / errors (Router.events). */
@Injectable({ providedIn: 'root' })
export class NavigationEventsService {
  private readonly router = inject(Router);
  private readonly log = inject(LoggingService);
  readonly navigating = signal(false);
  readonly currentUrl = signal(this.router.url);
  private startedAt = 0;

  constructor() {
    this.transitions$.pipe(takeUntilDestroyed()).subscribe(([from, to]) => { this.previousUrl.set(from); this.log.debug(`transition ${from} → ${to}`); });
    this.router.events.pipe(takeUntilDestroyed()).subscribe((e) => {
      if (e instanceof NavigationStart) { this.navigating.set(true); this.startedAt = performance.now(); }
      else if (e instanceof RoutesRecognized) { /* resolvers/guards finished matching */ }
      else if (e instanceof NavigationEnd) { this.navigating.set(false); this.currentUrl.set(e.urlAfterRedirects); this.log.debug(`navigated to ${e.urlAfterRedirects} in ${Math.round(performance.now() - this.startedAt)} ms`); }
      else if (e instanceof NavigationCancel) { this.navigating.set(false); }
      else if (e instanceof NavigationError) { this.navigating.set(false); this.log.error('navigation failed', e.error); }
    });
  }
  /** pairwise(): [previous, current] URL of every finished navigation (used for the log line and “back” links). */
  readonly transitions$ = this.router.events.pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd), map((e) => e.urlAfterRedirects), startWith(this.router.url), pairwise());
  readonly previousUrl = signal<string | null>(null);
  /** Typed stream of finished navigations. */
  readonly ends$ = this.router.events.pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd));
}
