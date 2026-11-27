import { Injectable, inject, signal } from '@angular/core';
import { ActivatedRouteSnapshot, NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';

export interface Breadcrumb {
  label: string;
  url: string;
}

/**
 * Builds breadcrumbs from the active route chain, listening to Router events.
 *  - static label:  `data: { breadcrumb: 'Employees' }` declared on the route itself (routeConfig.data, not the merged
 *    data, so children don't repeat a parent's label)
 *  - dynamic label: a ':id' route whose resolver exposed `employee` / `department` data shows that entity's name.
 */
@Injectable({ providedIn: 'root' })
export class BreadcrumbService {
  private readonly router = inject(Router);
  private readonly _crumbs = signal<Breadcrumb[]>([]);
  readonly crumbs = this._crumbs.asReadonly();

  constructor() {
    this.router.events.pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd)).subscribe(() => {
      this._crumbs.set(this.build(this.router.routerState.snapshot.root));
    });
  }

  private build(route: ActivatedRouteSnapshot, url = '', acc: Breadcrumb[] = []): Breadcrumb[] {
    const segment = route.url.map((s) => s.path).join('/');
    const next = segment ? `${url}/${segment}` : url;
    const label = this.labelFor(route);
    if (label) acc.push({ label, url: next || '/' });
    return route.firstChild ? this.build(route.firstChild, next, acc) : acc;
  }

  private labelFor(route: ActivatedRouteSnapshot): string | undefined {
    const path = route.routeConfig?.path ?? '';
    if (path.includes(':')) {
      const entity = (route.data['employee'] ?? route.data['department']) as { fullName?: string; name?: string } | undefined;
      const name = entity?.fullName ?? entity?.name;
      if (name) return name;
    }
    return route.routeConfig?.data?.['breadcrumb'] as string | undefined;
  }
}
