import { Injectable, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { EMPTY, Observable, Subject, catchError, map, merge, of, startWith, switchMap, tap, timer } from 'rxjs';
import { Paged } from '../models/api.models';
import { AppNotification } from '../models/misc.models';
import { APP_CONFIG } from '../tokens/tokens';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';

/**
 * Notification state. The backend offers plain REST (no WebSocket/SSE), so "real time" is short polling:
 *   authenticated$ ─switchMap→ merge(timer poll, manual refresh$) ─switchMap→ GET /notifications/unread-count
 * Logging out switches the inner stream off (EMPTY) so no request is made for anonymous users.
 */
@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly config = inject(APP_CONFIG);

  private readonly refresh$ = new Subject<void>();
  private readonly localDelta = signal(0);

  private readonly serverUnread = toSignal(
    toObservable(this.auth.isAuthenticated).pipe(
      switchMap((authenticated) =>
        authenticated
          ? merge(timer(0, this.config.notificationPollMs), this.refresh$).pipe(
              switchMap(() =>
                this.api.get<{ unread: number }>('/notifications/unread-count', undefined, { skipLoading: true, skipErrorToast: true, retry: false }).pipe(
                  map((r) => r.unread),
                  catchError(() => EMPTY),
                ),
              ),
              tap(() => this.localDelta.set(0)),
            )
          : of(0),
      ),
      startWith(0),
    ),
    { initialValue: 0 },
  );

  /** Server count adjusted by optimistic local reads, never below zero. */
  readonly unreadCount = computed(() => Math.max(0, this.serverUnread() + this.localDelta()));

  list(opts: { unread?: boolean; page?: number; limit?: number } = {}): Observable<Paged<AppNotification>> {
    return this.api.getPaged<AppNotification>('/notifications', { unread: opts.unread ? true : null, page: opts.page, limit: opts.limit });
  }

  recent(limit = 6): Observable<AppNotification[]> {
    return this.api.getPaged<AppNotification>('/notifications', { limit }, { skipLoading: true }).pipe(map((p) => p.items));
  }

  markRead(id: number): Observable<AppNotification> {
    return this.api.post<AppNotification>(`/notifications/${id}/read`).pipe(tap(() => this.localDelta.update((d) => d - 1)));
  }

  markAllRead(): Observable<{ updated: number }> {
    return this.api.post<{ updated: number }>('/notifications/read', {}).pipe(tap(() => this.refreshNow()));
  }

  refreshNow(): void {
    this.refresh$.next();
  }
}
