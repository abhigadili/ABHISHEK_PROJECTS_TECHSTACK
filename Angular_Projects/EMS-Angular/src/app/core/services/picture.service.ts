import { Injectable, OnDestroy, inject, signal } from '@angular/core';
import { Observable, map, shareReplay } from 'rxjs';
import { ApiService } from './api.service';

/**
 * Profile pictures are protected endpoints (Bearer token), so `<img src>` cannot load them directly.
 * We fetch each picture as a Blob through HttpClient (interceptors attach the token) and expose an object URL.
 * Results are cached per employee for the session and revoked on invalidate/destroy to avoid leaking blobs.
 */
@Injectable({ providedIn: 'root' })
export class PictureService implements OnDestroy {
  private readonly api = inject(ApiService);
  private readonly cache = new Map<number, { url$: Observable<string>; objectUrl?: string }>();

  forEmployee(employeeId: number): Observable<string> {
    let entry = this.cache.get(employeeId);
    if (!entry) {
      const created: { url$: Observable<string>; objectUrl?: string } = {
        url$: this.api.getBlob(`/employees/${employeeId}/picture`, undefined, { skipLoading: true, skipErrorToast: true }).pipe(
          map((blob) => {
            created.objectUrl = URL.createObjectURL(blob);
            return created.objectUrl;
          }),
          shareReplay({ bufferSize: 1, refCount: false }),
        ),
      };
      entry = created;
      this.cache.set(employeeId, entry);
    }
    return entry.url$;
  }

  invalidate(employeeId: number): void {
    const entry = this.cache.get(employeeId);
    if (entry?.objectUrl) URL.revokeObjectURL(entry.objectUrl);
    this.cache.delete(employeeId);
  }

  invalidateAll(): void {
    for (const id of [...this.cache.keys()]) this.invalidate(id);
    this.version.update((v) => v + 1);
  }

  /** Bumped on invalidateAll so ProfilePicture components can react to "my own picture changed". */
  readonly version = signal(0);

  ngOnDestroy(): void {
    this.invalidateAll();
  }
}
