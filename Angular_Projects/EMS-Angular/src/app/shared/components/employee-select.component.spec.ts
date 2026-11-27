import { Component } from '@angular/core';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { By } from '@angular/platform-browser';
import { envelope, http, meta, provideTestApp } from '../../../testing/test-helpers';
import { EmployeeSelectComponent } from './employee-select.component';

@Component({ standalone: true, imports: [ReactiveFormsModule, EmployeeSelectComponent], template: `<app-employee-select label="Manager" [formControl]="control" />` })
class HostComponent {
  control = new FormControl<number | null>(null);
}

const emp = (id: number, name: string) => ({ id, fullName: name, employeeCode: `EMP-${id}` });

describe('EmployeeSelectComponent (custom ControlValueAccessor)', () => {
  let fixture: ComponentFixture<HostComponent>;
  let control: FormControl<number | null>;
  const input = () => fixture.debugElement.query(By.css('input')).nativeElement as HTMLInputElement;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HostComponent], providers: provideTestApp() });
    fixture = TestBed.createComponent(HostComponent);
    control = fixture.componentInstance.control;
    fixture.detectChanges();
  });
  afterEach(() => http().verify());

  it('writeValue(id) loads the employee and shows the name (model → view)', fakeAsync(() => {
    control.setValue(7);
    const req = http().expectOne((r) => r.url.endsWith('/employees/7'));
    req.flush(envelope(emp(7, 'Hannah Manager')));
    fixture.detectChanges();
    tick();
    expect(input().value).toContain('Hannah Manager');
  }));

  it('writeValue(null) clears the display without any request', fakeAsync(() => {
    control.setValue(null);
    fixture.detectChanges();
    expect(input().value).toBe('');
    http().expectNone((r) => r.url.includes('/employees'));
  }));

  it('typing searches the directory (debounced, cancelling older searches) and choosing an option updates the form control (view → model)', fakeAsync(() => {
    input().value = 'han';
    input().dispatchEvent(new Event('input'));
    tick(250);
    const req = http().expectOne((r) => r.url.endsWith('/employees') && r.params.get('q') === 'han');
    expect(req.request.params.get('status')).toBe('ACTIVE');
    req.flush(envelope([emp(2, 'Hannah Manager')], meta(1)));
    fixture.detectChanges();
    const sel = fixture.debugElement.children[0].componentInstance as EmployeeSelectComponent;
    (sel as unknown as { onSelected: (e: unknown) => void }).onSelected({ option: { value: emp(2, 'Hannah Manager') } });
    expect(control.value).toBe(2);
  }));

  it('typing after a selection invalidates it (control becomes null)', fakeAsync(() => {
    control.setValue(3);
    http().expectOne((r) => r.url.endsWith('/employees/3')).flush(envelope(emp(3, 'Eve Engineer')));
    tick();
    input().value = 'ev';
    input().dispatchEvent(new Event('input'));
    expect(control.value).toBeNull();
    tick(250);
    http().expectOne((r) => r.url.endsWith('/employees')).flush(envelope([], meta(0)));
  }));

  it('respects disabled state from the form', () => {
    control.disable();
    fixture.detectChanges();
    expect(input().disabled).toBeTrue();
    control.enable();
    fixture.detectChanges();
    expect(input().disabled).toBeFalse();
  });

  it('is touched on blur (registerOnTouched)', () => {
    expect(control.touched).toBeFalse();
    input().dispatchEvent(new Event('blur'));
    expect(control.touched).toBeTrue();
  });
});
