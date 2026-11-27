import { Injectable, computed, effect, inject } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { BehaviorSubject, Observable, Subject, catchError, combineLatest, distinctUntilChanged, map, merge, of, retry, shareReplay, startWith, switchMap, timer } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { NotificationApiService } from '../api/notification-api.service';
import type { AppNotification, Page } from '../models';

export type NotificationCategory = 'Appointment' | 'Lab' | 'Billing' | 'Prescription' | 'Other';
export const categoryOf = (eventType: string): NotificationCategory => {
  const t = eventType.toUpperCase();
  return t.includes('APPOINTMENT') ? 'Appointment' : t.includes('LAB') ? 'Lab' : t.includes('BILL') || t.includes('PAYMENT') ? 'Billing' : t.includes('PRESCRIPTION') || t.includes('MEDICINE') ? 'Prescription' : 'Other';
};

/**
 * Notification centre – the RxJS showcase of the app.
 *  feed$        : timer(0, 30 s) → switchMap(API) → retry → shareReplay(1): polling stream (hot, shared by every subscriber, cached)
 *  readIds$     : BehaviorSubject<Set<number>>: read state (the backend has no read flag) persisted per user in localStorage
 *  refresh$     : Subject: manual refresh requests merged into the polling stream
 *  unreadCount  : combineLatest(feed$, readIds$) → map → toSignal (RxJS → Signal for templates & the header badge)
 * The backend has no push channel (no WebSocket/SSE), so polling is the supported real-time mechanism.
 */
@Injectable({ providedIn: 'root' })
export class NotificationCenterService {
  private readonly auth = inject(AuthService);
  private readonly api = inject(NotificationApiService);

  private readonly refreshSubject = new Subject<void>();
  readonly readIds$ = new BehaviorSubject<ReadonlySet<number>>(new Set());
  private readonly storageKey = computed(() => (this.auth.user() ? `hms.ng.notifications.read.${this.auth.user()!.id}` : null));

  /** Poll while signed in; restart on user change (switchMap), tolerate a failing poll (retry + catchError). */
  readonly feed$: Observable<readonly AppNotification[]> = toObservable(this.auth.user).pipe(
    distinctUntilChanged((a, b) => a?.id === b?.id),
    switchMap((user) => {
      if (!user) return of([] as readonly AppNotification[]);
      const load = (): Observable<Page<AppNotification>> => (user.role === 'ADMIN' ? this.api.all({ page: 0, size: 50 }) : this.api.my({ page: 0, size: 50 }));
      return merge(timer(0, 30_000), this.refreshSubject).pipe(
        switchMap(() => load().pipe(retry({ count: 1, delay: 1000 }), map((p) => p.content as readonly AppNotification[]), catchError(() => of([] as readonly AppNotification[])))),
      );
    }),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  readonly unreadCount$ = combineLatest([this.feed$, this.readIds$]).pipe(map(([feed, read]) => feed.filter((n) => !read.has(n.id)).length), startWith(0), distinctUntilChanged());
  /** RxJS → Signal for the header badge. */
  readonly unreadCount = toSignal(this.unreadCount$, { initialValue: 0 });
  readonly scope = computed(() => (this.auth.role() === 'ADMIN' ? 'all' : 'my'));

  constructor() {
    effect(() => {
      const key = this.storageKey();
      try { this.readIds$.next(key ? new Set(JSON.parse(localStorage.getItem(key) ?? '[]') as number[]) : new Set()); } catch { this.readIds$.next(new Set()); }
    }, { allowSignalWrites: true });
  }
  isRead(id: number): boolean { return this.readIds$.value.has(id); }
  markRead(id: number): void {
    if (this.readIds$.value.has(id)) return;
    this.persist(new Set(this.readIds$.value).add(id));
  }
  markAllRead(feed: readonly AppNotification[]): void {
    const next = new Set(this.readIds$.value);
    feed.forEach((n) => next.add(n.id));
    this.persist(next);
  }
  refresh(): void { this.refreshSubject.next(); }
  private persist(next: Set<number>): void {
    this.readIds$.next(next);
    const key = this.storageKey();
    if (key) try { localStorage.setItem(key, JSON.stringify([...next].slice(-2000))); } catch { /* ignore */ }
  }
}
