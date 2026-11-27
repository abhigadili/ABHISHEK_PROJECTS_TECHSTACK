import { ChangeDetectionStrategy, Component, computed, inject, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatMenuModule } from '@angular/material/menu';
import { Store } from '@ngrx/store';
import { TranslateModule } from '@ngx-translate/core';
import { AuthActions } from '../../state/ngrx/auth.state';
import { PermissionService } from '../../core/services/permission.service';
import { ModalComponent } from '../../shared/components/modal.component';
import { OpDialogComponent } from '../../shared/op/op-dialog.component';
import { GlobalSearchComponent } from './global-search.component';
import { NotificationCenterComponent } from './notification-center.component';
import { LanguageSwitcherComponent, ThemeSwitcherComponent } from './switchers.component';

const QUICK = [
  { op: 'leave.apply', icon: 'pi-calendar-plus', label: 'Apply for leave' }, { op: 'attendance.checkIn', icon: 'pi-sign-in', label: 'Check in' },
  { op: 'attendance.requestWfh', icon: 'pi-home', label: 'Request work from home' }, { op: 'performance.give', icon: 'pi-comments', label: 'Give feedback' },
];
@Component({
  selector: 'app-topbar', standalone: true, changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, MatMenuModule, TranslateModule, GlobalSearchComponent, NotificationCenterComponent, LanguageSwitcherComponent, ThemeSwitcherComponent, ModalComponent, OpDialogComponent],
  template: `
  <header class="no-print d-flex align-items-center gap-2 px-3" style="position:sticky;top:0;height:var(--hr-topbar);z-index:1050;background:var(--hr-surface);border-bottom:1px solid var(--hr-border)">
    <button type="button" class="btn-hr ghost icon d-lg-none" (click)="menu.emit()" aria-label="Open menu"><i class="pi pi-bars" style="font-size:18px"></i></button>
    <app-global-search />
    <div class="ms-auto d-flex align-items-center gap-1">
      @if (quick().length) { <button type="button" class="btn-hr soft sm" [matMenuTriggerFor]="qm"><i class="pi pi-bolt"></i><span class="d-none d-md-inline">{{ 'common.quickActions' | translate }}</span></button>
        <mat-menu #qm="matMenu">@for (q of quick(); track q.op) { <button mat-menu-item (click)="dlg.set(q.op)"><i class="pi me-2" [class]="q.icon"></i>{{ q.label }}</button> }</mat-menu> }
      <button type="button" class="btn-hr ghost icon" (click)="help.set(true)" [attr.aria-label]="'common.help' | translate"><i class="pi pi-question-circle" style="font-size:16px"></i></button>
      <span class="d-none d-sm-inline-flex"><app-language-switcher /></span>
      <app-theme-switcher />
      <app-notification-center />
      <button type="button" class="border-0 bg-transparent p-0 ms-1" [matMenuTriggerFor]="um" aria-label="User menu"><span class="d-inline-flex align-items-center justify-content-center rounded-circle" style="width:32px;height:32px;font-size:13px;font-weight:600;background:var(--hr-primary);color:rgb(var(--hr-primary-fg-rgb))">{{ initials() }}</span></button>
      <mat-menu #um="matMenu" xPosition="before">
        <div class="px-3 py-2"><div class="fw-semibold">{{ user()?.username }}</div><div class="text-muted" style="font-size:12px">{{ user()?.email }}</div><div class="mt-1 text-muted" style="font-size:11px">{{ user()?.roles?.join(', ') }}</div></div>
        <a mat-menu-item routerLink="/profile"><i class="pi pi-user me-2"></i>{{ 'nav.profile' | translate }}</a>
        <a mat-menu-item routerLink="/profile" [queryParams]="{ tab: 'security' }"><i class="pi pi-key me-2"></i>{{ 'auth.changeTitle' | translate }}</a>
        <button mat-menu-item (click)="logout()"><i class="pi pi-sign-out me-2"></i>{{ 'nav.signOut' | translate }}</button></mat-menu>
    </div>
    @if (dlg(); as d) { <app-op-dialog [open]="true" [op]="d" [title]="label(d)" (closed)="dlg.set(null)" /> }
    <app-modal [open]="help()" [title]="'common.help' | translate" (closed)="help.set(false)">
      <ul class="m-0 ps-3" style="font-size:13px"><li><kbd>Ctrl</kbd>/<kbd>⌘</kbd> + <kbd>K</kbd> — {{ 'nav.search' | translate }}</li><li>{{ 'common.quickActions' | translate }}: Apply for leave · Check in · Request work from home · Give feedback</li><li><a routerLink="/help" (click)="help.set(false)">{{ 'nav.help' | translate }} →</a></li></ul></app-modal>
  </header>`,
})
export class TopbarComponent {
  private store = inject(Store); private perm = inject(PermissionService);
  menu = output<void>(); user = this.perm.user; dlg = signal<string | null>(null); help = signal(false);
  quick = computed(() => { this.perm.user(); return QUICK.filter((q) => this.perm.canCall(q.op)); });
  initials = computed(() => (this.user()?.username ?? '?').slice(0, 2).toUpperCase());
  label = (op: string) => QUICK.find((q) => q.op === op)?.label ?? op;
  logout() { this.store.dispatch(AuthActions.logoutRequested()); }
}
