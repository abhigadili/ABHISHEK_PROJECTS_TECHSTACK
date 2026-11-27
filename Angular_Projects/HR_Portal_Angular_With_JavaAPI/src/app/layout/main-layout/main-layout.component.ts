import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { BreakpointObserver } from '@angular/cdk/layout';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { MatSidenavModule } from '@angular/material/sidenav';
import { animate, style, transition, trigger } from '@angular/animations';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslateModule } from '@ngx-translate/core';
import { filter, map } from 'rxjs';
import { connectionStore } from '../../state/zustand-style/connection.store';
import { uiStore } from '../../state/zustand-style/ui.store';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { TopbarComponent } from '../header/topbar.component';
import { BreadcrumbsComponent } from './breadcrumbs.component';
import { FooterComponent } from '../footer/footer.component';

@Component({
  selector: 'app-main-layout', standalone: true, changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, MatSidenavModule, TranslateModule, SidebarComponent, TopbarComponent, BreadcrumbsComponent, FooterComponent],
  animations: [trigger('page', [transition('* <=> *', [style({ opacity: 0, transform: 'translateY(8px)' }), animate('180ms ease-out', style({ opacity: 1, transform: 'none' }))])])],
  template: `
  <mat-sidenav-container style="background:transparent;min-height:100vh">
    <mat-sidenav [mode]="desktop() ? 'side' : 'over'" [opened]="desktop() || mobileOpen()" (closedStart)="mobileOpen.set(false)" [style.width.px]="desktop() ? (collapsed() ? 72 : 264) : 276" class="no-print side" fixedInViewport>
      <app-sidebar [collapsed]="desktop() && collapsed()" (navigated)="!desktop() && mobileOpen.set(false)" />
      @if (desktop()) { <button type="button" class="btn-hr outline icon m-2" (click)="toggle()" [attr.aria-label]="collapsed() ? 'Expand sidebar' : 'Collapse sidebar'"><i class="pi" [class.pi-angle-double-right]="collapsed()" [class.pi-angle-double-left]="!collapsed()"></i></button> }
    </mat-sidenav>
    <mat-sidenav-content>
      <app-topbar (menu)="mobileOpen.set(true)" />
      @if (!online()) { <div role="alert" class="d-flex align-items-center gap-2 px-4 py-2" style="font-size:13px;background:rgb(var(--hr-warning-rgb)/.2)"><i class="pi pi-exclamation-triangle"></i><strong>{{ 'common.backendDown' | translate }}</strong><span class="text-muted">{{ message() || ('common.backendDownHint' | translate) }}</span></div> }
      <main class="p-3 p-md-4"><app-breadcrumbs /><div [@page]="url()"><router-outlet /></div></main>
      <app-footer />
    </mat-sidenav-content>
  </mat-sidenav-container>`,
  styles: [`.side { background: var(--hr-surface); border-right: 1px solid var(--hr-border); transition: width .2s; overflow: hidden; display: flex; flex-direction: column; } :host ::ng-deep .mat-drawer-inner-container { display: flex; flex-direction: column; }`],
})
export class MainLayoutComponent {
  private router = inject(Router);
  desktop = toSignal(inject(BreakpointObserver).observe('(min-width: 992px)').pipe(map((r) => r.matches)), { initialValue: true });
  mobileOpen = signal(false); collapsed = uiStore.select((s) => s.sidebarCollapsed);
  online = connectionStore.select((s) => s.online); message = connectionStore.select((s) => s.message);
  url = toSignal(this.router.events.pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd), map((e) => e.urlAfterRedirects.split('?')[0])), { initialValue: this.router.url });
  toggle() { uiStore.set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })); }
  void0 = computed(() => 0);
}
