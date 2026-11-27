import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { signal } from '@angular/core';
import { envelope, http, meta, provideTestApp } from '../../../testing/test-helpers';
import { AuthService } from '../../core/services/auth.service';
import { BROWSER_STORAGE } from '../../core/tokens/tokens';
import { EmployeeFormComponent } from './employee-form.component';

class FakeAuth { role = signal('HR_ADMIN'); }

describe('EmployeeFormComponent (typed reactive form, FormArray, validators)', () => {
  let fixture: ComponentFixture<EmployeeFormComponent>;
  let cmp: EmployeeFormComponent & Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  let navigate: jasmine.Spy;

  function create(data: Record<string, unknown> = {}) {
    TestBed.configureTestingModule({
      imports: [EmployeeFormComponent],
      providers: [...provideTestApp(), { provide: AuthService, useValue: new FakeAuth() }, { provide: ActivatedRoute, useValue: { snapshot: { data } } }],
    });
    navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    fixture = TestBed.createComponent(EmployeeFormComponent);
    cmp = fixture.componentInstance as never;
    fixture.detectChanges();
    // reference lists requested by the dropdowns
    http().expectOne((r) => r.url.endsWith('/departments')).flush(envelope([{ id: 1, name: 'Engineering' }], meta(1)));
    http().expectOne((r) => r.url.endsWith('/designations')).flush(envelope([{ id: 1, name: 'Dev', jobLevel: 3 }], meta(1)));
  }
  afterEach(() => http().verify());

  const fillValid = () =>
    cmp['form'].patchValue({ firstName: 'Nora', lastName: 'Test', workEmail: 'nora@ems.test', joiningDate: '2026-01-05' });

  it('is invalid until required fields are filled and lists errors independently', () => {
    create();
    expect(cmp['form'].invalid).toBeTrue();
    cmp['form'].markAllAsTouched();
    expect(cmp['err']('firstName', 'First name')).toBe('First name is required');
    expect(cmp['err']('joiningDate', 'Joining date')).toBe('Joining date is required');
  });

  it('FormArray: add/remove education rows and validate each row on its own', () => {
    create();
    cmp['addEducation'](); cmp['addEducation']();
    expect(cmp['education'].length).toBe(2);
    cmp['education'].at(0).patchValue({ institution: 'MIT', degree: 'BSc' });
    expect(cmp['education'].at(0).valid).toBeTrue();
    expect(cmp['education'].at(1).invalid).toBeTrue();
    expect(cmp['form'].controls.education.invalid).toBeTrue();
    cmp['remove'](cmp['education'], 1);
    expect(cmp['education'].length).toBe(1);
    expect(cmp['form'].controls.education.valid).toBeTrue();
    expect(cmp['form'].dirty).toBeTrue();
  });

  it('login-account section: password rules apply only when "create account" is ticked (conditional validators)', () => {
    create();
    const acc = cmp['form'].controls.account.controls;
    expect(acc.password.disabled).toBeTrue();
    acc.create.setValue(true);
    expect(acc.password.enabled).toBeTrue();
    acc.password.setValue('weak');
    expect(acc.password.hasError('passwordComplexity')).toBeTrue();
    acc.password.setValue('Str0ng-Passw0rd!');
    acc.confirm.setValue('different');
    expect(cmp['form'].controls.account.hasError('mismatch')).toBeTrue();
    acc.confirm.setValue('Str0ng-Passw0rd!');
    expect(cmp['form'].controls.account.valid).toBeTrue();
    acc.create.setValue(false);
    expect(acc.password.disabled).toBeTrue();
  });

  it('async validator flags an e-mail that already exists in the directory', fakeAsync(() => {
    create();
    cmp['form'].controls.workEmail.setValue('eve.employee@ems.test');
    tick(400);
    const req = http().expectOne((r) => r.url.endsWith('/employees') && r.params.get('q') === 'eve.employee@ems.test');
    req.flush(envelope([{ id: 4, workEmail: 'eve.employee@ems.test' }], meta(1)));
    expect(cmp['form'].controls.workEmail.hasError('taken')).toBeTrue();
    expect(cmp['err']('workEmail', 'Work email')).toBe('This email is already in use');
  }));

  it('probation end before joining is a form-level error', () => {
    create();
    cmp['form'].patchValue({ joiningDate: '2026-05-01', probationEndDate: '2026-04-01' });
    expect(cmp['form'].hasError('probationBeforeJoining')).toBeTrue();
  });

  it('submit builds the API payload: blanks become null, work location is OMITTED when blank (backend 500s on null), extras stay local', fakeAsync(() => {
    create();
    fillValid();
    cmp['form'].controls.workEmail.setValue('nora@ems.test');
    tick(400);
    http().expectOne((r) => r.url.endsWith('/employees') && r.method === 'GET').flush(envelope([], meta(0)));
    cmp['addEducation']();
    cmp['education'].at(0).patchValue({ institution: 'MIT', degree: 'BSc' });
    cmp['submit']();
    const post = http().expectOne((r) => r.url.endsWith('/employees') && r.method === 'POST');
    const body = post.request.body;
    expect(body.firstName).toBe('Nora');
    expect(body.personalEmail).toBeNull();
    expect(body.phone).toBeNull();
    expect('workLocation' in body).toBeFalse();
    expect('account' in body).toBeFalse();
    expect('education' in body).toBeFalse(); // not part of the backend contract
    post.flush(envelope({ id: 42 }));
    tick();
    expect(navigate).toHaveBeenCalledWith(['/employees', 42]);
    // education/experience/skills are kept in browser storage (no backend API exists for them)
    expect(TestBed.inject(BROWSER_STORAGE).getItem('ems.employeeExtras.42')).toContain('MIT');
  }));

  it('maps backend validation details onto the matching controls', () => {
    create();
    cmp['applyServerErrors']([{ field: 'phone', message: 'phone is not a valid phone number' }, { field: 'city', message: 'too long' }]);
    expect(cmp['form'].controls.phone.errors).toEqual({ server: 'phone is not a valid phone number' });
    expect(cmp['form'].controls.address.controls.city.errors).toEqual({ server: 'too long' });
  });

  it('implements the unsaved-changes contract', () => {
    create();
    expect(cmp.hasUnsavedChanges()).toBeFalse();
    cmp['form'].controls.firstName.markAsDirty();
    expect(cmp.hasUnsavedChanges()).toBeTrue();
  });

  it('edit mode: patches from the resolved employee and locks the employee code', () => {
    create({ employee: { id: 4, employeeCode: 'EMP-2003', firstName: 'Eve', middleName: null, lastName: 'Engineer', fullName: 'Eve Engineer', workEmail: 'eve@ems.test', status: 'ACTIVE', employmentType: 'FULL_TIME', joiningDate: '2024-01-15', department: { id: 1, name: 'Engineering' }, designation: null, manager: null, address: {}, emergencyContact: {}, compensation: {} } });
    expect(cmp['isEdit']).toBeTrue();
    expect(cmp['form'].controls.firstName.value).toBe('Eve');
    expect(cmp['form'].controls.departmentId.value).toBe(1);
    expect(cmp['form'].controls.employeeCode.disabled).toBeTrue();
    expect(cmp['form'].pristine).toBeTrue();
    fixture.detectChanges();
    expect(fixture.debugElement.query(By.css('[data-testid="account-create"]'))).toBeNull(); // account section is create-only
  });
});
