import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { Subject, takeUntil } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { UserApiService } from '../../core/api/auth-api.service';
import type { UserAccount } from '../../core/models';
import { errorMessage } from '../../core/models/api-error';
import { NotificationService } from '../../core/services/notification.service';

/** NON-STANDALONE component (declared in AdminModule), constructor DI, lifecycle hooks, manual takeUntil(destroy$) and ChangeDetectorRef (classic style). */
@Component({
  selector: 'app-admin-users',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="mb-1 text-xl font-semibold">User accounts</h1><p class="mb-4 text-sm text-slate-500">Identity Service accounts (ADMIN only). This page belongs to the isolated NgModule-based admin feature.</p>
    <app-admin-user-form (created)="onCreated($event)"></app-admin-user-form>
    <p *ngIf="loading" class="text-sm text-slate-500">Loading…</p>
    <p *ngIf="error" role="alert" class="rounded-md bg-red-50 p-3 text-sm text-red-800">{{ error }} <button type="button" class="underline" (click)="load()">Retry</button></p>
    <div *ngIf="!loading && !error" class="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
      <table class="w-full text-sm"><thead><tr class="border-b text-left text-xs uppercase text-slate-500"><th class="p-3">User</th><th>E-mail</th><th>Role</th><th>Status</th><th></th></tr></thead>
        <tbody><tr *ngFor="let u of users; trackBy: trackById" class="border-b last:border-0"><td class="p-3 font-semibold">{{ u.username }}</td><td>{{ u.email }}</td><td>{{ u.role }}</td><td><span [ngClass]="u.enabled ? 'text-emerald-700' : 'text-slate-500'">{{ u.enabled ? 'Enabled' : 'Disabled' }}</span></td>
          <td><button type="button" class="text-sm underline disabled:opacity-40" [disabled]="u.id === me" (click)="toggle(u)">{{ u.enabled ? 'Disable' : 'Enable' }}</button></td></tr></tbody></table>
      <p *ngIf="users.length === 0" class="p-4 text-sm text-slate-500">No accounts.</p></div>`,
})
export class AdminUsersComponent implements OnInit, OnDestroy {
  users: UserAccount[] = [];
  loading = false;
  error: string | null = null;
  readonly me: number | undefined;
  private readonly destroy$ = new Subject<void>();
  constructor(private readonly api: UserApiService, private readonly notify: NotificationService, private readonly cdr: ChangeDetectorRef, auth: AuthService) { this.me = auth.user()?.id; }
  ngOnInit(): void { this.load(); }
  ngOnDestroy(): void { this.destroy$.next(); this.destroy$.complete(); }
  trackById(_: number, u: UserAccount) { return u.id; }
  load(): void {
    this.loading = true; this.error = null;
    this.api.list().pipe(takeUntil(this.destroy$)).subscribe({
      next: (u) => { this.users = u; this.loading = false; this.cdr.markForCheck(); },
      error: (e: unknown) => { this.error = errorMessage(e); this.loading = false; this.cdr.markForCheck(); },
    });
  }
  onCreated(u: UserAccount): void { this.users = [u, ...this.users]; this.cdr.markForCheck(); }
  toggle(u: UserAccount): void {
    this.api.setEnabled(u.id, !u.enabled).pipe(takeUntil(this.destroy$)).subscribe((n) => { this.users = this.users.map((x) => (x.id === n.id ? n : x)); this.notify.success(`${n.username} ${n.enabled ? 'enabled' : 'disabled'}`); this.cdr.markForCheck(); });
  }
}
