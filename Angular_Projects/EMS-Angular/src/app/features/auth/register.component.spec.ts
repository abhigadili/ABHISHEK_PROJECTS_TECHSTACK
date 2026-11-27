import { ComponentFixture, TestBed, fakeAsync, flush, tick } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { envelope, http, provideTestApp } from '../../../testing/test-helpers';
import { RegisterComponent } from './register.component';

const options = { departments: [{ id: 1, name: 'Engineering' }, { id: 3, name: 'Sales' }], designations: [{ id: 3, name: 'Software Engineer' }] };
const created = { id: 9, employeeId: 12, employeeCode: 'EMP-1010', username: 'rita.reg', email: 'rita@ems.example', role: 'EMPLOYEE' };

describe('RegisterComponent', () => {
  let fixture: ComponentFixture<RegisterComponent>;
  let navigate: jasmine.Spy;

  const el = (id: string) => fixture.debugElement.query(By.css(`[data-testid="${id}"]`))?.nativeElement as HTMLInputElement;
  const type = (id: string, value: string) => { el(id).value = value; el(id).dispatchEvent(new Event('input')); el(id).dispatchEvent(new Event('blur')); };
  const text = () => fixture.nativeElement.textContent as string;
  const submitForm = () => fixture.debugElement.query(By.css('form')).triggerEventHandler('ngSubmit');
  const controls = () => (fixture.componentInstance as unknown as { form: import('@angular/forms').FormGroup }).form.controls;

  /** fills every mandatory field with valid data; the username check (debounced 400 ms) is answered "available". */
  function fillValid(over: Record<string, string> = {}) {
    const v = { firstName: 'Rita', lastName: 'Reg', username: 'rita.reg', email: 'rita@ems.example', mobile: '+1 555 0123', dob: '1992-04-05', password: 'Str0ng!Passw0rd', confirm: 'Str0ng!Passw0rd', ...over };
    type('reg-firstName', v.firstName); type('reg-lastName', v.lastName); type('reg-username', v.username); type('reg-email', v.email);
    type('reg-mobile', v.mobile); type('reg-dob', v.dob); type('reg-password', v.password); type('reg-confirm', v.confirm);
    controls()['gender'].setValue('FEMALE');
    tick(450);
    http().match((r) => r.url.endsWith('/auth/username-available')).forEach((r) => r.flush(envelope({ available: true })));
    fixture.detectChanges();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [RegisterComponent], providers: provideTestApp() });
    navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    fixture = TestBed.createComponent(RegisterComponent);
    fixture.detectChanges();
    http().expectOne((r) => r.url.endsWith('/auth/registration-options')).flush(envelope(options));
    fixture.detectChanges();
  });
  afterEach(() => http().verify());

  it('renders every required field and loads department/designation choices from the backend', () => {
    for (const id of ['reg-firstName', 'reg-lastName', 'reg-username', 'reg-email', 'reg-mobile', 'reg-dob', 'reg-gender', 'reg-password', 'reg-confirm', 'reg-address', 'reg-department', 'reg-designation', 'reg-submit']) {
      expect(el(id)).withContext(id).toBeTruthy();
    }
    expect(text()).toContain('Choose picture');
    expect((fixture.componentInstance as unknown as { options: () => typeof options }).options().departments.length).toBe(2);
  });

  it('shows messages beside the fields and sends NOTHING when the form is invalid', () => {
    submitForm();
    fixture.detectChanges();
    expect(text()).toContain('First name is required');
    expect(text()).toContain('Username is required');
    expect(text()).toContain('Email is required');
    expect(text()).toContain('Mobile number is required');
    expect(text()).toContain('Password is required');
    expect(text()).toContain('Gender is required');
    http().expectNone((r) => r.url.endsWith('/auth/register'));
  });

  it('validates formats: username, email, mobile, password strength, confirm match, DOB in the past', fakeAsync(() => {
    type('reg-username', 'a@b'); type('reg-email', 'nope'); type('reg-mobile', 'abc'); type('reg-password', 'weak'); type('reg-confirm', 'other'); type('reg-dob', '2999-01-01');
    submitForm(); fixture.detectChanges();
    const t = text();
    expect(t).toContain('Letters, digits, dot, underscore or hyphen'); // 'a@b': 3 chars but an illegal character
    expect(t).toContain('Enter a valid email address');
    expect(t).toContain('Enter a valid phone number');
    expect(t).toContain('Password needs at least 10 characters');
    expect(t).toContain('Values do not match');
    expect(t).toContain('Date must be in the past');
    type('reg-username', 'ab'); fixture.detectChanges(); submitForm(); fixture.detectChanges();
    expect(text()).toContain('Username must be at least 3 characters');
    flush();
    http().expectNone((r) => r.url.endsWith('/auth/register'));
  }));

  it('checks username availability on the backend (debounced) and flags a taken username', fakeAsync(() => {
    type('reg-username', 'taken.name');
    tick(450);
    const req = http().expectOne((r) => r.url.endsWith('/auth/username-available'));
    expect(req.request.params.get('username')).toBe('taken.name');
    req.flush(envelope({ available: false }));
    fixture.detectChanges();
    expect(text()).toContain('This username is already taken');
    expect(controls()['username'].invalid).toBeTrue();
  }));

  it('submits multipart with ONLY contract fields (no confirmPassword, empty optionals omitted) then navigates to /login with the username', fakeAsync(() => {
    fillValid();
    submitForm();
    const req = http().expectOne((r) => r.url.endsWith('/auth/register'));
    const body = req.request.body as FormData;
    expect(body instanceof FormData).toBeTrue();
    expect(Object.fromEntries([...body.entries()].map(([k, v]) => [k, String(v)]))).toEqual({
      firstName: 'Rita', lastName: 'Reg', username: 'rita.reg', email: 'rita@ems.example', mobile: '+1 555 0123', password: 'Str0ng!Passw0rd', dateOfBirth: '1992-04-05', gender: 'FEMALE',
    });
    req.flush(envelope(created), { status: 201, statusText: 'Created' });
    flush();
    expect(navigate).toHaveBeenCalledWith(['/login'], { queryParams: { registered: 'rita.reg' } });
  }));

  it('shows a spinner/disabled button during submission and ignores repeated submits (exhaustMap)', fakeAsync(() => {
    fillValid();
    submitForm(); submitForm(); submitForm();
    expect(http().match((r) => r.url.endsWith('/auth/register')).length).toBe(1);
    fixture.detectChanges();
    expect(el('reg-submit').disabled).toBeTrue();
    expect(fixture.debugElement.query(By.css('[data-testid="reg-submit"] mat-spinner'))).toBeTruthy();
    flush();
  }));

  it('maps backend duplicate username/email errors onto the fields and re-enables the button', fakeAsync(() => {
    fillValid();
    submitForm();
    http().expectOne((r) => r.url.endsWith('/auth/register')).flush(
      { success: false, error: { code: 'DUPLICATE_USERNAME', message: 'This username is already taken', details: [{ field: 'username', message: 'This username is already taken' }, { field: 'email', message: 'This email address is already registered' }] } },
      { status: 409, statusText: 'Conflict' },
    );
    fixture.detectChanges();
    expect(text()).toContain('This username is already taken');
    expect(text()).toContain('This email address is already registered');
    expect(navigate).not.toHaveBeenCalled();
    expect(el('reg-submit').disabled).toBeFalse();
    flush();
  }));

  it('maps backend validation errors (400) onto fields', fakeAsync(() => {
    fillValid();
    submitForm();
    http().expectOne((r) => r.url.endsWith('/auth/register')).flush(
      { success: false, error: { code: 'VALIDATION_ERROR', message: 'Validation failed', details: [{ field: 'mobile', message: 'mobile is not a valid phone number' }] } },
      { status: 400, statusText: 'Bad Request' },
    );
    fixture.detectChanges();
    expect(text()).toContain('mobile is not a valid phone number');
    flush();
  }));

  it('shows a general error banner for network failures and allows a retry', fakeAsync(() => {
    fillValid();
    submitForm();
    http().expectOne((r) => r.url.endsWith('/auth/register')).error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown Error' });
    fixture.detectChanges();
    expect(fixture.debugElement.query(By.css('[data-testid="register-error"]')).nativeElement.textContent).toContain('Cannot reach the server');
    expect(el('reg-submit').disabled).toBeFalse();
    submitForm();
    http().expectOne((r) => r.url.endsWith('/auth/register')).flush(envelope(created), { status: 201, statusText: 'Created' });
    flush();
    expect(navigate).toHaveBeenCalled();
  }));

  it('sends the chosen picture as the `file` part and sends department/designation ids', fakeAsync(() => {
    fillValid();
    const file = new File([new Uint8Array(5)], 'me.png', { type: 'image/png' });
    (fixture.componentInstance as unknown as { onPicture: (f: File) => void }).onPicture(file);
    controls()['departmentId'].setValue('3'); controls()['designationId'].setValue('3');
    fixture.detectChanges();
    expect(el('reg-preview')).toBeTruthy();
    submitForm();
    const body = http().expectOne((r) => r.url.endsWith('/auth/register')).request.body as FormData;
    expect((body.get('file') as File).name).toBe('me.png');
    expect(body.get('departmentId')).toBe('3');
    expect(body.get('designationId')).toBe('3');
    flush();
  }));

  it('degrades gracefully when departments/designations cannot be loaded', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [RegisterComponent], providers: provideTestApp() });
    const f = TestBed.createComponent(RegisterComponent);
    f.detectChanges();
    TestBed.inject(Router);
    http().expectOne((r) => r.url.endsWith('/auth/registration-options')).flush({ success: false, error: { code: 'X', message: 'down' } }, { status: 500, statusText: 'err' });
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('could not be loaded');
  });
});
