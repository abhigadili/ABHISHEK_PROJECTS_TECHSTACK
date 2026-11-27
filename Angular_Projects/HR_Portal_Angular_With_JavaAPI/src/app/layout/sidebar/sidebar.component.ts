import { ChangeDetectionStrategy, Component, computed, inject, output, input } from '@angular/core';
import { RouterLink, RouterLinkActive, Router } from '@angular/router';
import { animate, state, style, transition, trigger } from '@angular/animations';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslateModule } from '@ngx-translate/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd } from '@angular/router';
import { filter, map } from 'rxjs';
import { NAV, type NavItem } from '../../core/constants/nav';
import { PermissionService } from '../../core/services/permission.service';
import { uiStore } from '../../state/zustand-style/ui.store';
import { APP } from '../../core/config/app.config';

@Component({
  selector: 'app-sidebar', standalone: true, changeDetection: ChangeDetectionStrategy.OnPush, imports: [RouterLink, RouterLinkActive, MatTooltipModule, TranslateModule],
  animations: [trigger('grp', [state('closed', style({ height: 0, opacity: 0, overflow: 'hidden' })), state('open', style({ height: '*', opacity: 1 })), transition('closed <=> open', animate('160ms ease'))])],
  template: `
  <nav aria-label="Main" class="d-flex flex-column h-100">
    <div class="d-flex align-items-center gap-2 px-3 fw-semibold" style="height:var(--hr-topbar);flex-shrink:0">
      <span class="rounded-3 p-2 d-inline-flex" style="background:var(--hr-primary);color:rgb(var(--hr-primary-fg-rgb))"><i class="pi pi-users"></i></span>@if (!collapsed()) { <span class="text-truncate">{{ appName }}</span> }</div>
    <div class="flex-grow-1 overflow-auto px-2 pb-3">
      @for (g of groups(); track g.key) {
        <div class="mb-1">
          @if (g.key !== 'main') {
            @if (!collapsed()) { <button type="button" class="d-flex w-100 align-items-center justify-content-between border-0 bg-transparent px-2 pt-3 pb-1 text-muted" style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.04em" (click)="toggle(g.key)" [attr.aria-expanded]="isOpen(g.key)">{{ 'nav.' + g.key | translate }}<i class="pi pi-chevron-down" style="font-size:10px;transition:transform .15s" [style.transform]="isOpen(g.key) ? '' : 'rotate(-90deg)'"></i></button> }
            @else { <hr class="mx-3 my-2" style="border-top:1px solid var(--hr-border)" /> } }
          <ul class="list-unstyled m-0 p-0" [@grp]="isOpen(g.key) || collapsed() || g.key === 'main' ? 'open' : 'closed'">
            @for (i of g.items; track i.key) { <li>
              <a [routerLink]="i.path" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: i.path === '/' }" class="nav-link-hr d-flex align-items-center gap-3 rounded-2 px-3 py-2 mb-1" [class.justify-content-center]="collapsed()" [class.px-0]="collapsed()"
                 (click)="navigated.emit()" [matTooltip]="collapsed() ? ('nav.' + i.key | translate) : ''" matTooltipPosition="right"><i class="pi" [class]="i.icon" style="font-size:16px"></i>@if (!collapsed()) { <span class="text-truncate">{{ 'nav.' + i.key | translate }}</span> }</a></li> }
          </ul>
        </div>
      }
    </div>
  </nav>`,
  styles: [`.nav-link-hr { font-size: 13px; font-weight: 500; color: var(--hr-text); text-decoration: none; } .nav-link-hr:hover { background: var(--hr-surface-2); text-decoration: none; } .nav-link-hr.active { background: var(--hr-primary-soft); color: var(--hr-primary); }`],
})
export class SidebarComponent {
  private perm = inject(PermissionService); private router = inject(Router);
  collapsed = input(false); navigated = output<void>(); appName = APP.name;
  private url = toSignal(this.router.events.pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd), map((e) => e.urlAfterRedirects)), { initialValue: this.router.url });
  groups = computed(() => {
    const p = this.perm; p.user();
    const ok = (i: NavItem) => (!i.roles && !i.anyOp) || (i.roles ? p.hasRole(...i.roles) : false) || (i.anyOp ? p.canAny(...i.anyOp) : false);
    return NAV.map((g) => ({ ...g, items: g.items.filter(ok) })).filter((g) => g.items.length);
  });
  isOpen(k: string) { const o = uiStore.state().openNavGroups[k]; const u = this.url(); return (o ?? true) || NAV.find((g) => g.key === k)!.items.some((i) => i.path !== '/' && u.startsWith(i.path)); }
  toggle(k: string) { uiStore.set((s) => ({ openNavGroups: { ...s.openNavGroups, [k]: !(s.openNavGroups[k] ?? true) } })); }
}
