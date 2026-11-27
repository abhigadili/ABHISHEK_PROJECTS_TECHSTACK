import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { envelope, http, meta, provideTestApp } from '../../testing/test-helpers';
import { AuthService } from '../core/services/auth.service';
import { NotificationMenuComponent } from './notification-menu.component';

const items = (unread: boolean) => [{ id: 1, userId: 4, type: 'LEAVE', title: 'Leave approved', message: 'Your leave was approved', refType: null, refId: null, isRead: !unread, readAt: null, createdAt: '2026-11-04 08:00:00' }];

describe('NotificationMenuComponent', () => {
  let fixture: ComponentFixture<NotificationMenuComponent>;
  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [NotificationMenuComponent], providers: [...provideTestApp(), { provide: AuthService, useValue: { isAuthenticated: signal(false) } }] });
    fixture = TestBed.createComponent(NotificationMenuComponent);
    fixture.detectChanges();
    TestBed.flushEffects();
  });
  afterEach(() => http().verify());

  it('lists recent notifications with unread styling', () => {
    http().expectOne((r) => r.url.endsWith('/notifications') && r.params.get('limit') === '6').flush(envelope(items(true), meta(1)));
    fixture.detectChanges();
    const item = fixture.debugElement.query(By.css('.item'));
    expect(item.nativeElement.textContent).toContain('Leave approved');
    expect(item.nativeElement.classList).toContain('unread');
  });

  it('shows an empty state when there are none', () => {
    http().expectOne((r) => r.url.endsWith('/notifications')).flush(envelope([], meta(0)));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain("You're all caught up");
  });

  it('clicking an item marks it read on the server, then reloads the list', () => {
    http().expectOne((r) => r.url.endsWith('/notifications')).flush(envelope(items(true), meta(1)));
    fixture.detectChanges();
    (fixture.debugElement.query(By.css('.item')).nativeElement as HTMLButtonElement).click();
    http().expectOne((r) => r.url.endsWith('/notifications/1/read') && r.method === 'POST').flush(envelope({ id: 1 }));
    http().expectOne((r) => r.url.endsWith('/notifications') && r.method === 'GET').flush(envelope(items(false), meta(1)));
    fixture.detectChanges();
    expect(fixture.debugElement.query(By.css('.item')).nativeElement.classList).not.toContain('unread');
  });
});
