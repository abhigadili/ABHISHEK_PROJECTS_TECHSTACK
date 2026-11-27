import { signal } from '@angular/core';
import { TestBed, fakeAsync, tick, discardPeriodicTasks } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { envelope, http, provideTestApp } from '../../../testing/test-helpers';
import { APP_CONFIG } from '../tokens/tokens';
import { AuthService } from './auth.service';
import { NotificationService } from './notification.service';

describe('NotificationService (signals + RxJS polling)', () => {
  const authenticated = signal(false);
  let svc: NotificationService;

  beforeEach(() => {
    authenticated.set(false);
    TestBed.configureTestingModule({
      providers: [
        ...provideTestApp(),
        { provide: AuthService, useValue: { isAuthenticated: authenticated } },
        { provide: APP_CONFIG, useValue: { apiTimeoutMs: 5000, notificationPollMs: 1000, defaultPageSize: 10, pageSizeOptions: [10] } },
      ],
    });
    svc = TestBed.inject(NotificationService);
  });

  const count = (n: number) => http().expectOne((r) => r.url.endsWith('/notifications/unread-count')).flush(envelope({ unread: n }));
  const settle = () => { TestBed.flushEffects(); tick(0); };

  it('makes no requests while logged out', fakeAsync(() => {
    settle();
    tick(5000);
    http().expectNone((r) => r.url.endsWith('/notifications/unread-count'));
    expect(svc.unreadCount()).toBe(0);
  }));

  it('starts polling on login, polls on an interval, and stops on logout', fakeAsync(() => {
    authenticated.set(true);
    settle();
    count(3);
    expect(svc.unreadCount()).toBe(3);
    tick(1000);
    count(4);
    expect(svc.unreadCount()).toBe(4);
    authenticated.set(false);
    settle();
    tick(5000);
    http().expectNone((r) => r.url.endsWith('/notifications/unread-count'));
    discardPeriodicTasks();
  }));

  it('markRead() lowers the badge immediately (optimistic delta), never below zero; the next poll is authoritative', fakeAsync(() => {
    authenticated.set(true);
    settle();
    count(1);
    void firstValueFrom(svc.markRead(7));
    http().expectOne((r) => r.url.endsWith('/notifications/7/read')).flush(envelope({ id: 7 }));
    expect(svc.unreadCount()).toBe(0);
    void firstValueFrom(svc.markRead(8));
    http().expectOne((r) => r.url.endsWith('/notifications/8/read')).flush(envelope({ id: 8 }));
    expect(svc.unreadCount()).toBe(0); // clamped
    tick(1000);
    count(2); // server truth wins and the local delta resets
    expect(svc.unreadCount()).toBe(2);
    discardPeriodicTasks();
  }));

  it('refreshNow() triggers an immediate poll (e.g. after approving leave)', fakeAsync(() => {
    authenticated.set(true);
    settle();
    count(0);
    svc.refreshNow();
    settle();
    count(5);
    expect(svc.unreadCount()).toBe(5);
    discardPeriodicTasks();
  }));

  it('a failing poll keeps the last known count instead of erroring the stream', fakeAsync(() => {
    authenticated.set(true);
    settle();
    count(2);
    tick(1000);
    http().expectOne((r) => r.url.endsWith('/notifications/unread-count')).flush({}, { status: 500, statusText: 'x' });
    expect(svc.unreadCount()).toBe(2);
    tick(1000);
    count(3); // stream is still alive
    expect(svc.unreadCount()).toBe(3);
    discardPeriodicTasks();
  }));
});
