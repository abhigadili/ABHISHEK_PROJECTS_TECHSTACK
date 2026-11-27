import { TestBed } from '@angular/core/testing';
import { SESSION_STORAGE } from '../tokens/tokens';
import { MemoryStorage } from '../../../testing/test-helpers';
import { TokenStorageService } from './token-storage.service';

describe('TokenStorageService (constructor injection of an InjectionToken)', () => {
  it('stores only the refresh token, in the injected session storage', () => {
    const store = new MemoryStorage();
    TestBed.configureTestingModule({ providers: [{ provide: SESSION_STORAGE, useValue: store }] });
    const svc = TestBed.inject(TokenStorageService);
    svc.setRefreshToken('abc');
    expect(store.getItem('ems.refreshToken')).toBe('abc');
    expect(svc.getRefreshToken()).toBe('abc');
    svc.clear();
    expect(svc.getRefreshToken()).toBeNull();
  });

  it('survives an unavailable storage (private mode) without throwing', () => {
    const broken = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); }, removeItem: () => { throw new Error('denied'); } } as unknown as Storage;
    TestBed.configureTestingModule({ providers: [{ provide: SESSION_STORAGE, useValue: broken }] });
    const svc = TestBed.inject(TokenStorageService);
    expect(() => svc.setRefreshToken('x')).not.toThrow();
    expect(svc.getRefreshToken()).toBeNull();
    expect(() => svc.clear()).not.toThrow();
  });
});
