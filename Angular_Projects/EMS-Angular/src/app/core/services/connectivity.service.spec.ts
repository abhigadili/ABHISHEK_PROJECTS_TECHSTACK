import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { ConnectivityService } from './connectivity.service';

describe('ConnectivityService (BehaviorSubject fed by merged window events)', () => {
  let svc: ConnectivityService;
  beforeEach(() => (svc = TestBed.inject(ConnectivityService)));

  it('late subscribers immediately receive the current value', async () => {
    expect(await firstValueFrom(svc.online$)).toBe(svc.isOnline);
  });

  it('follows offline/online events and replays the latest state to new subscribers', async () => {
    window.dispatchEvent(new Event('offline'));
    expect(svc.isOnline).toBeFalse();
    expect(await firstValueFrom(svc.online$)).toBeFalse();
    const seen: boolean[] = [];
    const sub = svc.online$.subscribe((v) => seen.push(v));
    window.dispatchEvent(new Event('online'));
    sub.unsubscribe();
    expect(seen).toEqual([false, true]);
    expect(svc.isOnline).toBeTrue();
  });
});
