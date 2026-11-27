import { Injectable, computed, inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { EMPTY, Observable, catchError, distinctUntilChanged, filter, map, of, shareReplay, switchMap } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { DoctorApiService } from '../api/doctor-api.service';
import { PatientApiService } from '../api/patient-api.service';
import type { Doctor, Patient } from '../models';

/**
 * Resolves the DOMAIN profile behind the login:
 *   PATIENT → GET /patients/by-user/{userId}/profile (404 = login without profile yet)
 *   DOCTOR  → no by-user endpoint exists, so the doctor list is searched for `userId`.
 * Each stream is cached with shareReplay(1) (API caching) and restarted when the user changes (switchMap).
 */
@Injectable({ providedIn: 'root' })
export class CurrentIdentityService {
  private readonly auth = inject(AuthService);
  private readonly patientsApi = inject(PatientApiService);
  private readonly doctorsApi = inject(DoctorApiService);

  private readonly userId$ = toObservable(computed(() => this.auth.user()?.id ?? null)).pipe(distinctUntilChanged());

  /** null = signed-in PATIENT without a profile. Completes empty for other roles. */
  readonly patient$: Observable<Patient | null> = this.userId$.pipe(
    switchMap((id) => {
      if (id === null || this.auth.role() !== 'PATIENT') return of(null);
      return this.patientsApi.byUserProfile(id).pipe(catchError(() => of(null)));
    }),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  readonly doctor$: Observable<Doctor | null> = this.userId$.pipe(
    switchMap((id) => {
      if (id === null || this.auth.role() !== 'DOCTOR') return of(null);
      return this.doctorsApi.list({ size: 100 }).pipe(
        map((p) => p.content.find((d) => d.userId === id) ?? null),
        catchError(() => of(null)),
      );
    }),
    shareReplay({ bufferSize: 1, refCount: true }),
  );
  /** Emits only when a real patient profile exists. */
  readonly knownPatient$ = this.patient$.pipe(filter((p): p is Patient => !!p));
  readonly never$ = EMPTY;
}
