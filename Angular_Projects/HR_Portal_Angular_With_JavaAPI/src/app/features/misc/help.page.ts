import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { PermissionService } from '../../core/services/permission.service';
import { CardComponent, PageHeaderComponent } from '../../shared/components/ui.components';

@Component({
  selector: 'app-help-page', standalone: true, imports: [RouterLink, TranslateModule, PageHeaderComponent, CardComponent], changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<app-page-header [title]="'nav.help' | translate" [subtitle]="'nav.search' | translate" />
  <div class="row g-3"><div class="col-md-6"><app-card><h3 class="fs-6">Getting started</h3><ul class="ps-3 mb-0" style="font-size:13px"><li>Use the sidebar to open a module; menu items appear only when your role allows them.</li><li>Press Ctrl/⌘ + K to search employees, departments, projects and customers.</li><li>Quick actions (top bar) start the most common requests: leave, check-in, work from home, feedback.</li><li>Tables support sorting, column selection and CSV / Excel / PDF export.</li></ul></app-card></div>
    <div class="col-md-6"><app-card><h3 class="fs-6">Your access</h3><div style="font-size:13px"><div><strong>Roles:</strong> {{ perm.user()?.roles?.join(', ') || '—' }}</div><div class="mt-1"><strong>Permissions:</strong> <span class="text-muted">{{ perm.user()?.permissions?.length ?? 0 }}</span></div><div class="mt-2 text-muted">Frontend visibility mirrors the backend rules for convenience only; the API enforces every permission.</div></div></app-card></div>
    @if (perm.isAdmin()) { <div class="col-12"><app-card><h3 class="fs-6">For administrators</h3><div style="font-size:13px"><a routerLink="/admin/api-explorer">API explorer</a> lists every backend endpoint; <a routerLink="/admin/coverage">Endpoint coverage</a> shows which UI exposes each one.</div></app-card></div> }</div>`,
})
export class HelpPage { perm = inject(PermissionService); }
export default HelpPage;
