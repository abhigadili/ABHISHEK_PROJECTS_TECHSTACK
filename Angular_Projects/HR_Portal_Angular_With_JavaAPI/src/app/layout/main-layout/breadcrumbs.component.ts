import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslateModule } from '@ngx-translate/core';
import { filter, map } from 'rxjs';

const KEYS: Record<string, string> = { employees: 'employees', directory: 'directory', 'org-chart': 'orgChart', organization: 'organization', leave: 'leave', attendance: 'attendance', holidays: 'holidays', timesheets: 'timesheets', payroll: 'payroll', tax: 'tax', performance: 'performance', exit: 'exit', customers: 'customers', projects: 'projects', documents: 'documents', approvals: 'approvals', reports: 'reports', notifications: 'notifications', admin: 'admin', users: 'users', roles: 'roles', audit: 'audit', 'api-explorer': 'apiExplorer', coverage: 'coverage', profile: 'profile', help: 'help' };
@Component({
  selector: 'app-breadcrumbs', standalone: true, imports: [RouterLink, TranslateModule], changeDetection: ChangeDetectionStrategy.OnPush,
  template: `@if (parts().length) { <nav aria-label="breadcrumb" class="no-print mb-2 d-flex flex-wrap align-items-center gap-1 text-muted" style="font-size:12px">
    <a routerLink="/" class="text-muted d-inline-flex align-items-center gap-1"><i class="pi pi-home" style="font-size:11px"></i>{{ 'nav.home' | translate }}</a>
    @for (p of parts(); track p.to; let last = $last) { <span class="d-inline-flex align-items-center gap-1"><i class="pi pi-angle-right" style="font-size:11px"></i>
      @if (last) { <span class="fw-semibold" style="color:var(--hr-text)">@if (p.key) { {{ 'nav.' + p.key | translate }} } @else { {{ p.label }} }</span> }
      @else { <a [routerLink]="p.to" class="text-muted">@if (p.key) { {{ 'nav.' + p.key | translate }} } @else { {{ p.label }} }</a> }</span> }</nav> }`,
})
export class BreadcrumbsComponent {
  private router = inject(Router);
  private url = toSignal(this.router.events.pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd), map((e) => e.urlAfterRedirects)), { initialValue: this.router.url });
  parts = computed(() => { const segs = this.url().split('?')[0].split('/').filter(Boolean); return segs.map((p, i) => ({ to: '/' + segs.slice(0, i + 1).join('/'), key: KEYS[p], label: p.length > 14 ? p.slice(0, 8) + '…' : p })); });
}
