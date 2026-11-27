import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { http, meta, provideTestApp } from '../../../testing/test-helpers';
import { ReferenceDataService } from './reference-data.service';

describe('ReferenceDataService (shareReplay caching)', () => {
  let svc: ReferenceDataService;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: provideTestApp() });
    svc = TestBed.inject(ReferenceDataService);
  });
  afterEach(() => http().verify());

  const flushDepartments = (names: string[]) =>
    http().expectOne((r) => r.url.endsWith('/departments')).flush({ success: true, message: 'ok', data: names.map((name, i) => ({ id: i + 1, name })), meta: meta(names.length) });

  it('many subscribers → ONE http call; later subscribers get the cached value without a request', async () => {
    const a = firstValueFrom(svc.departments());
    const b = firstValueFrom(svc.departments());
    flushDepartments(['Engineering']);
    expect((await a)[0].name).toBe('Engineering');
    expect((await b)[0].name).toBe('Engineering');
    const late = await firstValueFrom(svc.departments());
    expect(late.length).toBe(1);
    http().expectNone((r) => r.url.endsWith('/departments'));
  });

  it('invalidate() drops the cache so the next subscriber reloads fresh data', async () => {
    const first = firstValueFrom(svc.departments());
    flushDepartments(['Old']);
    await first;
    svc.invalidate('departments');
    const second = firstValueFrom(svc.departments());
    flushDepartments(['New']);
    expect((await second)[0].name).toBe('New');
  });

  it('leaveTypes() only exposes active types', async () => {
    const p = firstValueFrom(svc.leaveTypes());
    http().expectOne((r) => r.url.endsWith('/leave/types')).flush({ success: true, message: 'ok', data: [{ id: 1, isActive: true }, { id: 2, isActive: false }] });
    expect((await p).map((t) => t.id)).toEqual([1]);
  });
});
