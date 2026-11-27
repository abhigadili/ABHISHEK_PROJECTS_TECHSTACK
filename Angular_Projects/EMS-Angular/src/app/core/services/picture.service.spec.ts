import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { http, provideTestApp } from '../../../testing/test-helpers';
import { PictureService } from './picture.service';

describe('PictureService (blob cache)', () => {
  let svc: PictureService;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: provideTestApp() });
    svc = TestBed.inject(PictureService);
  });
  afterEach(() => http().verify());

  it('fetches the protected picture once per employee and caches the object URL', async () => {
    const a = firstValueFrom(svc.forEmployee(4));
    const b = firstValueFrom(svc.forEmployee(4));
    const reqs = http().match((r) => r.url.endsWith('/employees/4/picture'));
    expect(reqs.length).toBe(1);
    expect(reqs[0].request.responseType).toBe('blob');
    reqs[0].flush(new Blob(['img'], { type: 'image/png' }));
    const [u1, u2] = await Promise.all([a, b]);
    expect(u1).toMatch(/^blob:/);
    expect(u2).toBe(u1);
    http().expectNone((r) => r.url.endsWith('/employees/4/picture'));
  });

  it('invalidate() revokes the object URL and forces a reload; invalidateAll() bumps the version signal', async () => {
    const first = firstValueFrom(svc.forEmployee(4));
    http().expectOne((r) => r.url.endsWith('/employees/4/picture')).flush(new Blob(['1']));
    const url = await first;
    const revoke = spyOn(URL, 'revokeObjectURL').and.callThrough();
    const before = svc.version();
    svc.invalidateAll();
    expect(revoke).toHaveBeenCalledWith(url);
    expect(svc.version()).toBe(before + 1);
    const again = firstValueFrom(svc.forEmployee(4));
    http().expectOne((r) => r.url.endsWith('/employees/4/picture')).flush(new Blob(['2']));
    expect(await again).not.toBe(url);
  });
});
