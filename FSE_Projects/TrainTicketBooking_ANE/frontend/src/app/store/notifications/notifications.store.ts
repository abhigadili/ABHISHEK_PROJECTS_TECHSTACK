import { Injectable, inject, isDevMode } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { EntityAdapter, EntityState, createEntityAdapter } from '@ngrx/entity';
import { Store, createAction, createFeature, createReducer, createSelector, on, props } from '@ngrx/store';
import { catchError, filter, map, mergeMap, of, switchMap, takeUntil, tap, timer } from 'rxjs';
import { APP_CONFIG } from '../../core/config/tokens';
import { AuthService } from '../../core/auth/auth.service';
import type { NotificationItem, PageMeta } from '../../core/models/models';
import { NotificationApi } from '../../core/services/account.services';

/** NgRx feature: notifications of the signed-in user (Entity adapter + effects with polling). The backend has no push channel, so polling is used. */
export const NotificationActions = {
  load: createAction('[Notifications] Load', props<{ page: number; size: number; unreadOnly: boolean; quiet?: boolean }>()),
  loadSuccess: createAction('[Notifications] Load Success', props<{ items: NotificationItem[]; unread: number; meta: PageMeta }>()),
  loadFailure: createAction('[Notifications] Load Failure', props<{ error: string }>()),
  markRead: createAction('[Notifications] Mark Read', props<{ id: number }>()),
  markReadSuccess: createAction('[Notifications] Mark Read Success', props<{ id: number }>()),
  markAllRead: createAction('[Notifications] Mark All Read'),
  markAllReadSuccess: createAction('[Notifications] Mark All Read Success'),
  startPolling: createAction('[Notifications] Start Polling'),
  stopPolling: createAction('[Notifications] Stop Polling'),
  reset: createAction('[Notifications] Reset'),
};

export interface NotificationsState extends EntityState<NotificationItem> { unread: number; meta: PageMeta | null; loading: boolean; error: string | null; loaded: boolean }
export const adapter: EntityAdapter<NotificationItem> = createEntityAdapter<NotificationItem>({ sortComparer: (a, b) => b.createdAt.localeCompare(a.createdAt) });
const initial: NotificationsState = adapter.getInitialState({ unread: 0, meta: null, loading: false, error: null, loaded: false });

export const notificationsFeature = createFeature({
  name: 'notifications',
  reducer: createReducer(initial,
    on(NotificationActions.load, (s, a) => ({ ...s, loading: !a.quiet, error: null })),
    on(NotificationActions.loadSuccess, (s, a) => adapter.setAll(a.items, { ...s, unread: a.unread, meta: a.meta, loading: false, loaded: true })),
    on(NotificationActions.loadFailure, (s, a) => ({ ...s, loading: false, error: a.error })),
    on(NotificationActions.markReadSuccess, (s, a) => {
      const was = s.entities[a.id]; const wasUnread = !!was && !was.readAt;
      return adapter.updateOne({ id: a.id, changes: { readAt: new Date().toISOString() } }, { ...s, unread: Math.max(0, s.unread - (wasUnread ? 1 : 0)) });
    }),
    on(NotificationActions.markAllReadSuccess, (s) => adapter.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() }), { ...s, unread: 0 })),
    on(NotificationActions.reset, () => initial),
  ),
  extraSelectors: ({ selectNotificationsState }) => ({ ...adapter.getSelectors(selectNotificationsState) }),
});
export const { selectAll: selectAllNotifications, selectUnread, selectLoading: selectNotificationsLoading, selectMeta: selectNotificationsMeta, selectError: selectNotificationsError } = notificationsFeature;
export const selectLatestUnread = createSelector(selectAllNotifications, (all) => all.filter((n) => !n.readAt).slice(0, 5));

@Injectable()
export class NotificationEffects {
  private readonly actions$ = inject(Actions);
  private readonly api = inject(NotificationApi);
  private readonly auth = inject(AuthService);
  private readonly cfg = inject(APP_CONFIG);
  private readonly store = inject(Store);

  load$ = createEffect(() => this.actions$.pipe(
    ofType(NotificationActions.load),
    switchMap(({ page, size, unreadOnly, quiet }) => this.api.list({ page, size, unread: unreadOnly }, quiet).pipe(
      map((r) => NotificationActions.loadSuccess({ items: r.data.items, unread: r.data.unread, meta: r.meta! })),
      catchError((e) => of(NotificationActions.loadFailure({ error: e?.message ?? 'Could not load notifications' }))),
    )),
  ));
  markRead$ = createEffect(() => this.actions$.pipe(ofType(NotificationActions.markRead), mergeMap(({ id }) => this.api.markRead(id).pipe(map(() => NotificationActions.markReadSuccess({ id })), catchError(() => of(NotificationActions.loadFailure({ error: 'Could not update the notification' })))))));
  markAll$ = createEffect(() => this.actions$.pipe(ofType(NotificationActions.markAllRead), switchMap(() => this.api.markAllRead().pipe(map(() => NotificationActions.markAllReadSuccess()), catchError(() => of(NotificationActions.loadFailure({ error: 'Could not update notifications' })))))));
  /** Poll until stopPolling (or logout) - takeUntil cancels the timer; the first tick is immediate. */
  poll$ = createEffect(() => this.actions$.pipe(
    ofType(NotificationActions.startPolling),
    switchMap(() => timer(0, this.cfg.notificationPollSeconds * 1000).pipe(
      takeUntil(this.actions$.pipe(ofType(NotificationActions.stopPolling))),
      filter(() => this.auth.isAuthenticated()),
      map(() => NotificationActions.load({ page: 0, size: 20, unreadOnly: false, quiet: true })),
    )),
  ));
  /** Sign-out wipes the cached notifications. */
  clearOnLogout$ = createEffect(() => this.auth.events$.pipe(filter((e) => e.type !== 'login'), mergeMap(() => [NotificationActions.stopPolling(), NotificationActions.reset()])));
  /** Dev aid. */
  log$ = createEffect(() => this.actions$.pipe(tap((a) => { if (isDevMode() && a.type.startsWith('[Notifications] Load Failure')) console.warn(a); })), { dispatch: false });
}
