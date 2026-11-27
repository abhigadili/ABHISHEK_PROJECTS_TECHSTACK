import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { envelope, http, provideTestApp } from '../../../testing/test-helpers';
import { DepartmentFormComponent } from './department-form.component';

describe('DepartmentFormComponent (FormBuilder + input binding)', () => {
  let fixture: ComponentFixture<DepartmentFormComponent>;
  let navigate: jasmine.Spy;
  const field = (id: string) => fixture.debugElement.query(By.css(`[data-testid="${id}"]`)).nativeElement as HTMLInputElement;
  const set = (id: string, v: string) => { field(id).value = v; field(id).dispatchEvent(new Event('input')); };

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [DepartmentFormComponent], providers: provideTestApp() });
    navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    fixture = TestBed.createComponent(DepartmentFormComponent);
    fixture.detectChanges();
  });
  afterEach(() => http().verify());

  it('create: upper-cases the code as you type and validates required + pattern', () => {
    set('dept-code', 'qa-1');
    expect(fixture.componentInstance['form'].controls.code.value).toBe('QA-1');
    set('dept-code', 'bad code!');
    fixture.componentInstance['upper']();
    expect(fixture.componentInstance['form'].controls.code.hasError('pattern')).toBeTrue();
    fixture.componentInstance['form'].markAllAsTouched();
    fixture.componentInstance['submit']();
    http().expectNone((r) => r.url.endsWith('/departments'));
  });

  it('create: posts the trimmed body and navigates to the new department', () => {
    set('dept-code', 'ops');
    set('dept-name', '  Operations ');
    fixture.componentInstance['submit']();
    const req = http().expectOne((r) => r.url.endsWith('/departments') && r.method === 'POST');
    expect(req.request.body).toEqual({ code: 'OPS', name: 'Operations', description: null, headEmployeeId: null });
    req.flush(envelope({ id: 9 }));
    expect(navigate).toHaveBeenCalledWith(['/departments', 9]);
  });

  it('edit: the resolved department arrives via the signal input and patches the form without making it dirty', () => {
    fixture.componentRef.setInput('department', { id: 5, code: 'ENG', name: 'Engineering', description: 'Builders', headEmployeeId: null });
    fixture.detectChanges();
    expect(field('dept-name').value).toBe('Engineering');
    expect(fixture.componentInstance.hasUnsavedChanges()).toBeFalse();
    set('dept-name', 'Engineering & Platform');
    expect(fixture.componentInstance.hasUnsavedChanges()).toBeTrue();
    fixture.componentInstance['submit']();
    const req = http().expectOne((r) => r.url.endsWith('/departments/5') && r.method === 'PUT');
    expect(req.request.body.name).toBe('Engineering & Platform');
    req.flush(envelope({ id: 5 }));
  });

  it('shows the backend validation message on the right field (duplicate code → 409)', () => {
    set('dept-code', 'ENG');
    set('dept-name', 'Dup');
    fixture.componentInstance['submit']();
    http().expectOne((r) => r.method === 'POST').flush({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Validation failed', details: [{ field: 'code', message: 'code already exists' }] } }, { status: 400, statusText: 'Bad Request' });
    fixture.detectChanges();
    expect(fixture.componentInstance['form'].controls.code.errors).toEqual({ server: 'code already exists' });
    expect(fixture.componentInstance['saving']()).toBeFalse();
  });
});
