import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MemoryStorage, provideTestApp } from '../../../testing/test-helpers';
import { Role } from '../models/auth.models';
import { BROWSER_STORAGE } from '../tokens/tokens';
import { AuthService } from './auth.service';
import { PermissionService } from './permission.service';
import { DEFAULT_PREFERENCES, PreferencesService } from './preferences.service';

describe('PreferencesService (signal + effect persistence)', () => {
  it('starts from defaults, merges updates and persists through an effect', () => {
    const storage = new MemoryStorage();
    TestBed.configureTestingModule({ providers: [...provideTestApp(), { provide: BROWSER_STORAGE, useValue: storage }] });
    const prefs = TestBed.inject(PreferencesService);
    expect(prefs.prefs()).toEqual(DEFAULT_PREFERENCES);
    prefs.update({ pageSize: 25, density: 'compact' });
    TestBed.flushEffects();
    expect(prefs.prefs().pageSize).toBe(25);
    expect(JSON.parse(storage.getItem('ems.preferences')!).density).toBe('compact');
  });

  it('restores saved preferences and tolerates corrupted storage', () => {
    const storage = new MemoryStorage();
    storage.setItem('ems.preferences', JSON.stringify({ pageSize: 50 }));
    TestBed.configureTestingModule({ providers: [...provideTestApp(), { provide: BROWSER_STORAGE, useValue: storage }] });
    expect(TestBed.inject(PreferencesService).prefs().pageSize).toBe(50);
    TestBed.resetTestingModule();
    const bad = new MemoryStorage();
    bad.setItem('ems.preferences', '{not json');
    TestBed.configureTestingModule({ providers: [...provideTestApp(), { provide: BROWSER_STORAGE, useValue: bad }] });
    expect(TestBed.inject(PreferencesService).prefs()).toEqual(DEFAULT_PREFERENCES);
  });
});

describe('PermissionService (computed from the role signal)', () => {
  const role = signal<Role | null>(null);
  let svc: PermissionService;
  beforeEach(() => {
    role.set(null);
    TestBed.configureTestingModule({ providers: [...provideTestApp(), { provide: AuthService, useValue: { role } }] });
    svc = TestBed.inject(PermissionService);
  });

  it('anonymous has nothing; employees have nothing special', () => {
    expect(svc.permissions().size).toBe(0);
    role.set('EMPLOYEE');
    expect(svc.has('leave.approve')).toBeFalse();
  });
  it('managers approve leave and see reports but cannot administer', () => {
    role.set('MANAGER');
    expect(svc.has('leave.approve')).toBeTrue();
    expect(svc.has('report.view')).toBeTrue();
    expect(svc.has('employee.write')).toBeFalse();
    expect(svc.has('report.admin')).toBeFalse();
  });
  it('HR admin administers, but only SUPER_ADMIN may assign roles', () => {
    role.set('HR_ADMIN');
    expect(svc.has('employee.write')).toBeTrue();
    expect(svc.has('role.assign')).toBeFalse();
    role.set('SUPER_ADMIN');
    expect(svc.has('role.assign')).toBeTrue();
  });
  it('hasAny / hasRole helpers', () => {
    role.set('MANAGER');
    expect(svc.hasAny(['employee.write', 'leave.approve'])).toBeTrue();
    expect(svc.hasAny(['employee.write'])).toBeFalse();
    expect(svc.hasRole(['MANAGER', 'HR_ADMIN'])).toBeTrue();
    expect(svc.hasRole(['EMPLOYEE'])).toBeFalse();
  });
});
