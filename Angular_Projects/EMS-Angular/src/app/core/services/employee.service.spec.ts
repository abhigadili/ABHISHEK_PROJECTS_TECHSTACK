import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { http, meta, provideTestApp, respond } from '../../../testing/test-helpers';
import { EmployeeService } from './employee.service';

const emp = (id: number, email: string) => ({ id, workEmail: email, fullName: `E${id}` });

describe('EmployeeService', () => {
  let svc: EmployeeService;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: provideTestApp() });
    svc = TestBed.inject(EmployeeService);
  });
  afterEach(() => http().verify());

  it('list() maps filters to query params, trims the search and drops empty values', async () => {
    const p = firstValueFrom(svc.list({ q: '  eve ', departmentId: 3, designationId: null, status: 'ACTIVE', sort: 'name:asc', page: 2, limit: 5 }));
    const req = http().expectOne((r) => r.url.endsWith('/employees'));
    expect(req.request.params.get('q')).toBe('eve');
    expect(req.request.params.get('departmentId')).toBe('3');
    expect(req.request.params.has('designationId')).toBeFalse();
    expect(req.request.params.get('page')).toBe('2');
    req.flush({ success: true, message: 'ok', data: [emp(1, 'a@b.co')], meta: meta(11, 2, 5) });
    const res = await p;
    expect(res.items.length).toBe(1);
    expect(res.meta).toEqual({ page: 2, limit: 5, total: 11, totalPages: 3 });
  });

  it('get / create / update / deactivate / reactivate hit the right verbs and paths', () => {
    svc.get(4).subscribe();
    expect(respond('/employees/4', emp(4, 'x@y.z')).request.method).toBe('GET');
    svc.create({ firstName: 'A' }).subscribe();
    const c = respond('/employees', emp(5, 'a@b.co'), undefined, 'POST');
    expect(c.request.body).toEqual({ firstName: 'A' });
    svc.update(5, { jobTitle: 'Dev' }).subscribe();
    expect(respond('/employees/5', emp(5, 'a@b.co'), undefined, 'PUT').request.body).toEqual({ jobTitle: 'Dev' });
    svc.deactivate(5, { reason: 'left' }).subscribe();
    expect(respond('/employees/5/deactivate', emp(5, 'a@b.co')).request.body).toEqual({ reason: 'left' });
    svc.reactivate(5).subscribe();
    expect(respond('/employees/5/reactivate', emp(5, 'a@b.co')).request.method).toBe('POST');
  });

  it('uploadPicture sends multipart with the single "file" field to the admin endpoint', () => {
    const file = new File(['x'], 'p.png', { type: 'image/png' });
    svc.uploadPicture(9, file).subscribe();
    const req = http().expectOne((r) => r.url.endsWith('/employees/9/picture'));
    expect(req.request.method).toBe('PUT');
    expect((req.request.body as FormData).get('file')).toBeInstanceOf(File);
    req.flush({ success: true, message: 'ok', data: {} });
  });

  describe('emailExists (backs the async validator)', () => {
    it('is true when a different employee has the address (case-insensitive)', async () => {
      const p = firstValueFrom(svc.emailExists('  EVE@ems.test '));
      const req = http().expectOne((r) => r.url.endsWith('/employees'));
      expect(req.request.params.get('q')).toBe('eve@ems.test');
      expect(req.request.params.get('status')).toBe('ALL');
      req.flush({ success: true, message: 'ok', data: [emp(4, 'Eve@ems.test')], meta: meta(1) });
      expect(await p).toBeTrue();
    });
    it('ignores the employee being edited', async () => {
      const p = firstValueFrom(svc.emailExists('eve@ems.test', 4));
      http().expectOne((r) => r.url.endsWith('/employees')).flush({ success: true, message: 'ok', data: [emp(4, 'eve@ems.test')], meta: meta(1) });
      expect(await p).toBeFalse();
    });
    it('a partial match (substring search hit) is not a duplicate', async () => {
      const p = firstValueFrom(svc.emailExists('eve@ems.test'));
      http().expectOne((r) => r.url.endsWith('/employees')).flush({ success: true, message: 'ok', data: [emp(8, 'steve@ems.test')], meta: meta(1) });
      expect(await p).toBeFalse();
    });
  });
});
