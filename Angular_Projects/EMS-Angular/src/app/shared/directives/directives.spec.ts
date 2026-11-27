import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Permission, Role } from '../../core/models/auth.models';
import { AuthService } from '../../core/services/auth.service';
import { provideTestApp } from '../../../testing/test-helpers';
import { AutofocusDirective, HasPermissionDirective, HasRoleDirective, HighlightDirective, NumbersOnlyDirective } from './directives';

/** Fake AuthService exposing only what PermissionService reads: a role signal we can flip. */
class FakeAuth {
  readonly role = signal<Role | null>('EMPLOYEE');
}

@Component({
  standalone: true,
  imports: [HasRoleDirective, HasPermissionDirective, HighlightDirective, NumbersOnlyDirective, AutofocusDirective],
  template: `
    <button id="admin-only" *appHasRole="['HR_ADMIN', 'SUPER_ADMIN']">admin</button>
    <button id="approve" *appHasPermission="'leave.approve'">approve</button>
    <button id="any-of" *appHasPermission="anyOf">any</button>
    <div id="hl" [appHighlight]="'rgb(255, 0, 0)'">hover me</div>
    <input id="num" appNumbersOnly />
    <input id="focus" appAutofocus />
  `,
})
class HostComponent {
  anyOf: Permission[] = ['report.admin', 'audit.view'];
}

describe('custom directives', () => {
  let fixture: ComponentFixture<HostComponent>;
  let auth: FakeAuth;
  const has = (id: string) => !!fixture.debugElement.query(By.css(`#${id}`));

  beforeEach(() => {
    auth = new FakeAuth();
    TestBed.configureTestingModule({ imports: [HostComponent], providers: [...provideTestApp(), { provide: AuthService, useValue: auth }] });
    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
  });

  it('*appHasRole hides content from unlisted roles', () => {
    expect(has('admin-only')).toBeFalse();
  });

  it('*appHasRole reacts to role changes (signal effect) in both directions', () => {
    auth.role.set('HR_ADMIN');
    fixture.detectChanges();
    expect(has('admin-only')).toBeTrue();
    auth.role.set('EMPLOYEE');
    fixture.detectChanges();
    expect(has('admin-only')).toBeFalse();
  });

  it('*appHasPermission follows the role→permission matrix', () => {
    expect(has('approve')).toBeFalse();
    auth.role.set('MANAGER');
    fixture.detectChanges();
    expect(has('approve')).toBeTrue();
    expect(has('any-of')).toBeFalse(); // managers have neither report.admin nor audit.view
    auth.role.set('SUPER_ADMIN');
    fixture.detectChanges();
    expect(has('any-of')).toBeTrue();
  });

  it('appHighlight toggles the background on mouseenter/leave', () => {
    const el = fixture.debugElement.query(By.css('#hl'));
    el.triggerEventHandler('mouseenter');
    fixture.detectChanges();
    expect(el.nativeElement.style.backgroundColor).toBe('rgb(255, 0, 0)');
    el.triggerEventHandler('mouseleave');
    fixture.detectChanges();
    expect(el.nativeElement.style.backgroundColor).toBe('');
  });

  it('appNumbersOnly strips non-digits and keeps the model event flowing', () => {
    const input: HTMLInputElement = fixture.debugElement.query(By.css('#num')).nativeElement;
    input.value = '12ab-3 4';
    input.dispatchEvent(new Event('input'));
    expect(input.value).toBe('1234');
  });

  it('appAutofocus focuses the element after render', async () => {
    await fixture.whenStable();
    expect(document.activeElement?.id).toBe('focus');
  });
});
