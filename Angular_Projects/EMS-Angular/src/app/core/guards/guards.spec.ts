import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { AsyncSubject } from 'rxjs';
import { provideTestApp } from '../../../testing/test-helpers';
import { Role } from '../models/auth.models';
import { AuthService } from '../services/auth.service';
import { authGuard, childAccessGuard, guestGuard, permissionGuard, roleGuard, unsavedChangesGuard } from './guards';

class FakeAuth {
  readonly sessionReady$ = new AsyncSubject<boolean>();
  readonly isAuthenticated = signal(false);
  readonly role = signal<Role | null>(null);
}

const route = (data: Record<string, unknown> = {}) => ({ data }) as unknown as ActivatedRouteSnapshot;
const state = (url: string) => ({ url }) as RouterStateSnapshot;

describe('route guards', () => {
  let auth: FakeAuth;
  let router: Router;
  const run = <T>(fn: () => T): T => TestBed.runInInjectionContext(fn);
  const asUrl = (r: unknown) => router.serializeUrl(r as UrlTree);

  beforeEach(() => {
    auth = new FakeAuth();
    TestBed.configureTestingModule({ providers: [...provideTestApp(), { provide: AuthService, useValue: auth }] });
    router = TestBed.inject(Router);
  });

  const ready = () => { auth.sessionReady$.next(true); auth.sessionReady$.complete(); };

  describe('authGuard', () => {
    it('waits for the session restore, then lets authenticated users in', async () => {
      const pending = run(() => authGuard(route(), state('/employees')) as Promise<unknown>);
      auth.isAuthenticated.set(true);
      ready();
      expect(await pending).toBeTrue();
    });
    it('redirects anonymous users to /login keeping the returnUrl', async () => {
      ready();
      const result = await run(() => authGuard(route(), state('/employees?page=2')) as Promise<unknown>);
      expect(asUrl(result)).toBe('/login?returnUrl=%2Femployees%3Fpage%3D2');
    });
  });

  describe('guestGuard', () => {
    it('lets anonymous users see the login page', async () => {
      ready();
      expect(await run(() => guestGuard(route(), state('/login')) as Promise<unknown>)).toBeTrue();
    });
    it('sends logged-in users to the dashboard', async () => {
      auth.isAuthenticated.set(true);
      ready();
      expect(asUrl(await run(() => guestGuard(route(), state('/login')) as Promise<unknown>))).toBe('/dashboard');
    });
  });

  describe('roleGuard / permissionGuard (route data driven)', () => {
    it('roleGuard allows listed roles and redirects others to /unauthorized', () => {
      const r = route({ roles: ['HR_ADMIN', 'SUPER_ADMIN'] });
      auth.role.set('MANAGER');
      expect(asUrl(run(() => roleGuard(r, state('/x'))))).toBe('/unauthorized');
      auth.role.set('HR_ADMIN');
      expect(run(() => roleGuard(r, state('/x')))).toBeTrue();
    });
    it('roleGuard with no roles configured allows everyone', () => {
      expect(run(() => roleGuard(route(), state('/x')))).toBeTrue();
    });
    it('permissionGuard checks any-of the required permissions', () => {
      const r = route({ permissions: ['leave.approve'] });
      auth.role.set('EMPLOYEE');
      expect(asUrl(run(() => permissionGuard(r, state('/x'))))).toBe('/unauthorized');
      auth.role.set('MANAGER');
      expect(run(() => permissionGuard(r, state('/x')))).toBeTrue();
    });
    it('childAccessGuard combines both checks', () => {
      auth.role.set('EMPLOYEE');
      const denied = run(() => childAccessGuard(route({ roles: ['MANAGER'] }), state('/x')));
      expect(asUrl(denied)).toBe('/unauthorized');
      auth.role.set('MANAGER');
      expect(run(() => childAccessGuard(route({ roles: ['MANAGER'], permissions: ['leave.approve'] }), state('/x')))).toBeTrue();
    });
  });

  describe('unsavedChangesGuard (CanDeactivate)', () => {
    it('allows leaving a clean form without asking', () => {
      const confirmSpy = spyOn(window, 'confirm');
      expect(run(() => unsavedChangesGuard({ hasUnsavedChanges: () => false }, route(), state('/a'), state('/b')))).toBeTrue();
      expect(confirmSpy).not.toHaveBeenCalled();
    });
    it('asks for confirmation when dirty and respects the answer', () => {
      const confirmSpy = spyOn(window, 'confirm').and.returnValues(false, true);
      const dirty = { hasUnsavedChanges: () => true };
      expect(run(() => unsavedChangesGuard(dirty, route(), state('/a'), state('/b')))).toBeFalse();
      expect(run(() => unsavedChangesGuard(dirty, route(), state('/a'), state('/b')))).toBeTrue();
      expect(confirmSpy).toHaveBeenCalledTimes(2);
    });
  });
});
