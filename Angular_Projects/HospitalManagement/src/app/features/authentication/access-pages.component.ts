import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

/** 403 page. `from` is the blocked URL, bound from the query string by component input binding. */
@Component({
  selector: 'app-access-denied',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="mx-auto flex min-h-[50vh] max-w-md flex-col items-center justify-center gap-3 text-center"><div class="text-5xl">⛔</div><h1 class="text-2xl font-bold">403 · Access denied</h1>
    <p class="text-sm text-slate-500">Your role is not allowed to open {{ from() ? from() : 'this page' }}.</p><a routerLink="/dashboard" class="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium">Back to dashboard</a></div>`,
})
export class AccessDeniedComponent { readonly from = input<string>(); }

@Component({
  selector: 'app-unauthorized',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-3 p-6 text-center"><div class="text-5xl">🔒</div><h1 class="text-2xl font-bold">401 · Sign in required</h1><p class="text-sm text-slate-500">You need to sign in to see this page.</p><a routerLink="/auth/login" class="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white">Go to sign in</a></div>`,
})
export class UnauthorizedComponent {}

@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="mx-auto flex min-h-[50vh] max-w-md flex-col items-center justify-center gap-3 text-center"><h1 class="text-6xl font-bold text-brand-600">404</h1><p class="text-sm text-slate-500">The page you are looking for does not exist.</p><a routerLink="/dashboard" class="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium">Back to dashboard</a></div>`,
})
export class NotFoundComponent {}
