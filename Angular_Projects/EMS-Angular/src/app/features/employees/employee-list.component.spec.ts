import { signal } from '@angular/core';
import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { envelope, http, meta, provideTestApp } from '../../../testing/test-helpers';
import { AuthService } from '../../core/services/auth.service';
import { EmployeeListComponent } from './employee-list.component';

const people = [
  { id: 1, employeeCode: 'EMP-1', fullName: 'Eve Engineer', workEmail: 'eve@ems.test', status: 'ACTIVE', department: { id: 1, name: 'Engineering' }, designation: { id: 1, name: 'Dev' }, jobTitle: 'Dev', joiningDate: '2024-01-15', profilePictureUrl: null },
  { id: 2, employeeCode: 'EMP-2', fullName: 'Hannah Manager', workEmail: 'h@ems.test', status: 'INACTIVE', department: null, designation: null, jobTitle: null, joiningDate: '2023-05-01', profilePictureUrl: null },
];

describe('EmployeeListComponent (URL-driven filters)', () => {
  let harness: RouterTestingHarness;
  let router: Router;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [...provideTestApp({ extra: [provideRouter([{ path: 'employees', component: EmployeeListComponent }, { path: 'employees/:id', children: [] }])] }), { provide: AuthService, useValue: { role: signal('HR_ADMIN') } }],
    });
    router = TestBed.inject(Router);
    harness = await RouterTestingHarness.create();
  });
  afterEach(() => http().verify());

  const answerLookups = () => {
    http().expectOne((r) => r.url.endsWith('/departments')).flush(envelope([{ id: 1, name: 'Engineering' }], meta(1)));
    http().expectOne((r) => r.url.endsWith('/designations')).flush(envelope([{ id: 1, name: 'Dev' }], meta(1)));
  };

  it('reads filters, sort and page from the query string and sends them to the API', async () => {
    await harness.navigateByUrl('/employees?q=eve&departmentId=1&status=ALL&sort=joiningDate:desc&page=2&limit=5');
    harness.detectChanges();
    answerLookups();
    TestBed.flushEffects();
    const req = http().expectOne((r) => r.url.endsWith('/employees'));
    expect(req.request.params.get('q')).toBe('eve');
    expect(req.request.params.get('departmentId')).toBe('1');
    expect(req.request.params.get('status')).toBe('ALL');
    expect(req.request.params.get('sort')).toBe('joiningDate:desc');
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('limit')).toBe('5');
    req.flush(envelope(people, meta(12, 2, 5)));
  });

  it('renders rows with status badges and permission-gated actions', async () => {
    await harness.navigateByUrl('/employees');
    harness.detectChanges();
    answerLookups();
    TestBed.flushEffects();
    http().expectOne((r) => r.url.endsWith('/employees')).flush(envelope(people, meta(2)));
    harness.detectChanges();
    const rows = harness.fixture.debugElement.queryAll(By.css('tr.mat-mdc-row'));
    expect(rows.length).toBe(2);
    expect(rows[0].nativeElement.textContent).toContain('Eve Engineer');
    expect(rows[0].nativeElement.textContent).toContain('Active');
    expect(rows[1].nativeElement.textContent).toContain('Inactive');
    expect(harness.fixture.nativeElement.querySelector('[data-testid="new-employee"]')).not.toBeNull(); // HR_ADMIN can create
    expect(rows[0].nativeElement.querySelector('[aria-label="Deactivate employee"]')).not.toBeNull();
    expect(rows[1].nativeElement.querySelector('[aria-label="Reactivate employee"]')).not.toBeNull();
  });

  it('typing in the search box updates the URL (debounced) and re-queries', fakeAsync(() => {
    void harness.navigateByUrl('/employees');
    tick();
    harness.detectChanges();
    answerLookups();
    TestBed.flushEffects();
    http().expectOne((r) => r.url.endsWith('/employees')).flush(envelope(people, meta(2)));
    harness.detectChanges();
    const input = harness.fixture.debugElement.query(By.css('[data-testid="search-input"]')).nativeElement as HTMLInputElement;
    input.value = 'eve';
    input.dispatchEvent(new Event('input'));
    tick(300);
    tick();
    harness.detectChanges();
    tick();
    expect(router.url).toContain('q=eve');
    TestBed.flushEffects();
    tick();
    const req = http().expectOne((r) => r.url.endsWith('/employees'));
    expect(req.request.params.get('q')).toBe('eve');
    expect(req.request.params.get('page')).toBe('1'); // paging resets when a filter changes
    req.flush(envelope([people[0]], meta(1)));
  }));
});
