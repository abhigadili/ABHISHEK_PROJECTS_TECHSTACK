import { EnvironmentInjector, Injectable, computed, inject, runInInjectionContext } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Store } from '@ngrx/store';
import { Observable, catchError, distinctUntilChanged, map, of, switchMap, take, tap } from 'rxjs';
import { DoctorApiService } from '../../core/api/doctor-api.service';
import { AuthService } from '../../core/auth/auth.service';
import { CurrentIdentityService } from '../../core/services/current-identity.service';
import { AppointmentsActions } from '../../state/actions/appointments.actions';
import type { FeedScope } from '../../state/entities/appointments.entity';
import { selectAllAppointments, selectAppointmentStats, selectAppointmentsError, selectAppointmentsLoading, selectUpcomingAppointments } from '../../state/selectors/appointments.selectors';

/**
 * Facade between components and the NgRx appointments slice. There is NO "all appointments" endpoint in the backend, so the
 * feed scope depends on the role:  PATIENT → own patient id · DOCTOR → own doctor id · ADMIN → every doctor (parallel requests in the effect).
 * Components only use signals + `load()`; they never know about actions, selectors or identity resolution.
 */
@Injectable({ providedIn: 'root' })
export class AppointmentFeedFacade {
  private readonly store = inject(Store);
  private readonly auth = inject(AuthService);
  private readonly identity = inject(CurrentIdentityService);
  private readonly doctors = inject(DoctorApiService);
  private readonly env = inject(EnvironmentInjector);

  readonly all = this.store.selectSignal(selectAllAppointments);
  readonly stats = this.store.selectSignal(selectAppointmentStats);
  readonly upcoming = this.store.selectSignal(selectUpcomingAppointments);
  readonly loading = this.store.selectSignal(selectAppointmentsLoading);
  readonly error = this.store.selectSignal(selectAppointmentsError);
  readonly supported = computed(() => ['ADMIN', 'DOCTOR', 'PATIENT'].includes(this.auth.role() ?? ''));
  readonly scopeLabel = computed(() => ({ ADMIN: 'All doctors', DOCTOR: 'Your patients', PATIENT: 'Your appointments' } as Record<string, string>)[this.auth.role() ?? ''] ?? '');

  /** Resolve the scope for the current user (Observable<FeedScope | null>). */
  scope$(): Observable<FeedScope | null> {
    return toObservable(this.auth.role).pipe(
      distinctUntilChanged(),
      switchMap((role): Observable<FeedScope | null> => {
        if (role === 'PATIENT') return this.identity.patient$.pipe(map((p) => (p ? { kind: 'patient', patientId: p.id } : null)));
        if (role === 'DOCTOR') return this.identity.doctor$.pipe(map((d) => (d ? { kind: 'doctors', doctorIds: [d.id] } : null)));
        if (role === 'ADMIN') return this.doctors.list({ size: 100 }).pipe(map((p) => ({ kind: 'doctors', doctorIds: p.content.map((d) => d.id) } as FeedScope)), catchError(() => of(null)));
        return of(null);
      }),
    );
  }
  /** Loads (or refreshes) the feed – dispatches the request action; the effect + reducer do the rest. */
  load(): void {
    // runInInjectionContext: toObservable() needs an injection context, but load() is called from effects / event handlers
    runInInjectionContext(this.env, () => this.scope$()).pipe(take(1), tap((scope) => { if (scope) this.store.dispatch(AppointmentsActions.loadFeed({ scope })); })).subscribe();
  }
  readonly role = toSignal(toObservable(this.auth.role));
}
