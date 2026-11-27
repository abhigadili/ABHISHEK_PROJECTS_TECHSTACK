import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter, map, startWith } from 'rxjs';

interface Crumb { label: string; url: string }

/** Breadcrumbs built from the router state: walks the ActivatedRoute tree and reads `data.breadcrumb` of each segment. */
@Component({
  selector: 'app-breadcrumbs',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (crumbs().length > 0) {
      <nav aria-label="Breadcrumb" class="no-print mb-3 flex flex-wrap items-center gap-1 text-xs text-slate-500">
        <a routerLink="/dashboard" class="hover:text-slate-900 dark:hover:text-white">Home</a>
        @for (c of crumbs(); track c.url; let last = $last) {
          <span aria-hidden="true">›</span>
          @if (last) { <span aria-current="page" class="font-semibold text-slate-900 dark:text-white">{{ c.label }}</span> } @else { <a [routerLink]="c.url" class="hover:text-slate-900 dark:hover:text-white">{{ c.label }}</a> }
        }
      </nav>
    }`,
})
export class BreadcrumbsComponent {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  protected readonly crumbs = toSignal(
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd), startWith(null), map(() => this.build(this.route.root))),
    { initialValue: [] as Crumb[] },
  );
  private build(route: ActivatedRoute, url = '', out: Crumb[] = []): Crumb[] {
    for (const child of route.children) {
      if (child.outlet !== 'primary' || !child.snapshot) continue; // snapshot is not set yet while a navigation is in flight
      const seg = child.snapshot.url.map((s) => s.path).join('/');
      const next = seg ? `${url}/${seg}` : url;
      const label = child.snapshot.data['breadcrumb'] as string | undefined;
      if (label && next !== '/dashboard' && out[out.length - 1]?.url !== (next || '/')) out.push({ label: label.replace(/:(\w+)/g, (_, k) => '#' + (child.snapshot.paramMap.get(k) ?? '')), url: next || '/' });
      this.build(child, next, out);
    }
    return out;
  }
}
