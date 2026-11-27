import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

/** Admin layout: thin wrapper that frames the administration pages (used by the isolated NgModule-based admin feature). */
@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [RouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="rounded-xl border border-amber-300/60 bg-amber-50/40 p-1 dark:border-amber-700/40 dark:bg-amber-950/10"><p class="px-4 pt-3 text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-300">Administration</p><div class="p-3"><router-outlet /></div></div>`,
})
export class AdminLayoutComponent {}
