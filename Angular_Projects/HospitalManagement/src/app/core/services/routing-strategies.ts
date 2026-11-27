import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, DetachedRouteHandle, PreloadingStrategy, Route, RouteReuseStrategy } from '@angular/router';
import { Observable, of, timer, mergeMap } from 'rxjs';

/**
 * CUSTOM PRELOADING STRATEGY: routes marked `data: { preload: <delayMs> }` are loaded in the background after the
 * given delay (frequently used clinical areas); everything else stays lazy (admin, billing …) to protect bandwidth.
 */
@Injectable({ providedIn: 'root' })
export class SelectivePreloadingStrategy implements PreloadingStrategy {
  readonly preloaded: string[] = [];
  preload(route: Route, load: () => Observable<unknown>): Observable<unknown> {
    const delay = route.data?.['preload'];
    if (typeof delay !== 'number') return of(null);
    return timer(delay).pipe(mergeMap(() => { this.preloaded.push(route.path ?? ''); return load(); }));
  }
}

/**
 * CUSTOM ROUTE REUSE STRATEGY: list pages flagged `data: { reuse: true }` are detached and re-attached when the user
 * navigates back from a detail page – scroll position, filters and the loaded table survive the round trip.
 */
@Injectable()
export class ListReuseStrategy implements RouteReuseStrategy {
  private readonly cache = new Map<string, DetachedRouteHandle>();
  private key(r: ActivatedRouteSnapshot): string {
    return r.pathFromRoot.map((s) => s.url.map((u) => u.path).join('/')).filter(Boolean).join('/');
  }
  shouldDetach(r: ActivatedRouteSnapshot): boolean { return r.data['reuse'] === true; }
  store(r: ActivatedRouteSnapshot, h: DetachedRouteHandle | null): void { if (h) this.cache.set(this.key(r), h); }
  shouldAttach(r: ActivatedRouteSnapshot): boolean { return r.data['reuse'] === true && this.cache.has(this.key(r)); }
  retrieve(r: ActivatedRouteSnapshot): DetachedRouteHandle | null { return this.cache.get(this.key(r)) ?? null; }
  shouldReuseRoute(future: ActivatedRouteSnapshot, curr: ActivatedRouteSnapshot): boolean { return future.routeConfig === curr.routeConfig; }
}
