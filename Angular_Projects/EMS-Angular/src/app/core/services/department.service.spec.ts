import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { http, meta, provideTestApp, respond } from '../../../testing/test-helpers';
import { DepartmentService } from './department.service';
import { ReferenceDataService } from './reference-data.service';

describe('DepartmentService', () => {
  let svc: DepartmentService;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: provideTestApp() });
    svc = TestBed.inject(DepartmentService);
  });
  afterEach(() => http().verify());

  it('list() sends search + active filter + paging', async () => {
    const p = firstValueFrom(svc.list({ q: ' eng ', isActive: true, page: 1, limit: 10 }));
    const req = http().expectOne((r) => r.url.endsWith('/departments'));
    expect(req.request.params.get('q')).toBe('eng');
    expect(req.request.params.get('isActive')).toBe('true');
    req.flush({ success: true, message: 'ok', data: [{ id: 1, name: 'Engineering' }], meta: meta(1) });
    expect((await p).items[0].name).toBe('Engineering');
  });

  it('create/update/deactivate/activate use the documented endpoints', () => {
    svc.create({ code: 'QA', name: 'Quality' }).subscribe();
    expect(respond('/departments', { id: 9 }, undefined, 'POST').request.body).toEqual({ code: 'QA', name: 'Quality' });
    svc.update(9, { name: 'QA' }).subscribe();
    expect(respond('/departments/9', { id: 9 }, undefined, 'PUT').request.method).toBe('PUT');
    svc.deactivate(9).subscribe();
    expect(respond('/departments/9', { id: 9 }, undefined, 'DELETE').request.method).toBe('DELETE');
    svc.activate(9).subscribe();
    expect(respond('/departments/9/activate', { id: 9 }).request.method).toBe('POST');
  });

  it('writes invalidate the cached reference list so dropdowns refresh', () => {
    const ref = TestBed.inject(ReferenceDataService);
    const spy = spyOn(ref, 'invalidate').and.callThrough();
    svc.create({ code: 'A', name: 'A' }).subscribe();
    respond('/departments', { id: 1 }, undefined, 'POST');
    expect(spy).toHaveBeenCalledWith('departments');
  });

  it('teams(departmentId) filters server-side', () => {
    svc.teams(4).subscribe();
    const req = http().expectOne((r) => r.url.endsWith('/teams'));
    expect(req.request.params.get('departmentId')).toBe('4');
    req.flush({ success: true, message: 'ok', data: [], meta: meta(0) });
  });
});
