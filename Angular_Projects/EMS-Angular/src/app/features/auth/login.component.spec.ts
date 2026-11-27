import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { envelope, failWith, http, provideTestApp } from '../../../testing/test-helpers';
import { LoginComponent } from './login.component';

const loginOk = { accessToken: 'a', refreshToken: 'r-xxxxxxxxxxxxxxxxxxxxxx', tokenType: 'Bearer', expiresIn: '15m', user: { id: 1, email: 'a@b.co', role: 'EMPLOYEE', employeeId: 2 } };

describe('LoginComponent', () => {
  let fixture: ComponentFixture<LoginComponent>;
  let navigateByUrl: jasmine.Spy;
  const el = (testId: string) => fixture.debugElement.query(By.css(`[data-testid="${testId}"]`)).nativeElement as HTMLInputElement;
  const fill = (email: string, password: string) => {
    el('login-email').value = email; el('login-email').dispatchEvent(new Event('input'));
    el('login-password').value = password; el('login-password').dispatchEvent(new Event('input'));
  };
  const submitForm = () => fixture.debugElement.query(By.css('form')).triggerEventHandler('ngSubmit');

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [LoginComponent], providers: provideTestApp() });
    navigateByUrl = spyOn(TestBed.inject(Router), 'navigateByUrl').and.resolveTo(true);
    fixture = TestBed.createComponent(LoginComponent);
    fixture.detectChanges();
  });
  afterEach(() => http().verify());

  it('shows required errors and sends nothing for an invalid form', () => {
    fill('', '');
    submitForm();
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Username or email is required');
    expect(text).toContain('Password is required');
    http().expectNone((r) => r.url.endsWith('/auth/login'));
  });

  it('exhaustMap: rapid repeated submits produce exactly ONE login request while one is in flight', () => {
    fill('a@b.co', 'secret');
    submitForm(); submitForm(); submitForm();
    const reqs = http().match((r) => r.url.endsWith('/auth/login'));
    expect(reqs.length).toBe(1);
    expect(reqs[0].request.body).toEqual({ email: 'a@b.co', password: 'secret' });
    fixture.detectChanges();
    expect(el('login-submit').disabled).toBeTrue();
    reqs[0].flush(envelope(loginOk));
    http().expectOne((r) => r.url.endsWith('/auth/me')).flush(envelope({ id: 1, email: 'a@b.co', role: 'EMPLOYEE', lastLoginAt: null, employee: null }));
    expect(navigateByUrl).toHaveBeenCalledTimes(1);
  });

  it('after a failure the form is usable again and shows the backend message', () => {
    fill('a@b.co', 'wrong');
    submitForm();
    failWith('/auth/login', 401, 'INVALID_CREDENTIALS', 'Invalid email or password');
    fixture.detectChanges();
    expect(fixture.debugElement.query(By.css('[data-testid="login-error"]')).nativeElement.textContent).toContain('Invalid email or password');
    expect(el('login-submit').disabled).toBeFalse();
    submitForm(); // exhaustMap released → a new attempt is possible
    http().expectOne((r) => r.url.endsWith('/auth/login')).flush(envelope(loginOk));
    http().expectOne((r) => r.url.endsWith('/auth/me')).flush(envelope({ id: 1, email: 'a@b.co', role: 'EMPLOYEE', lastLoginAt: null, employee: null }));
    expect(navigateByUrl).toHaveBeenCalled();
  });

  it('a username (no "@") is sent as `username`, lower-cased', () => {
    fill('Rita.Reg', 'secret');
    submitForm();
    expect(http().expectOne((r) => r.url.endsWith('/auth/login')).request.body).toEqual({ username: 'rita.reg', password: 'secret' });
  });

  it('shows a link to the registration page', () => {
    expect(fixture.debugElement.query(By.css('[data-testid="register-link"]')).nativeElement.getAttribute('href')).toBe('/register');
  });
});
