import { inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { catchError, concatMap, exhaustMap, map, mergeMap, of, switchMap, tap, withLatestFrom } from 'rxjs';
import { DoctorApiService } from '../../core/api/doctor-api.service';
import { errorMessage } from '../../core/models/api-error';
import { NotificationService } from '../../core/services/notification.service';
import * as A from '../actions/doctors.actions';
import { persistFilters } from '../entities/doctors.entity';
import { selectDoctorFilters } from '../selectors/doctors.selectors';

/**
 * FUNCTIONAL effects (NgRx 19): each effect is a plain exported constant created with `createEffect(() => …, { functional: true })`
 * and dependencies are taken with inject() (default parameter values).
 *   loadDoctors      switchMap  – a newer request cancels the previous one (filter toggles)
 *   loadDoctor       mergeMap   – independent lookups may run in parallel
 *   createDoctor     exhaustMap – ignore a second click while the first request runs (no duplicate registrations)
 *   update/deactivate concatMap – queued, executed one after another, order preserved
 *   persistFilters   non-dispatching effect (`dispatch: false`) – side effect only
 */
export const loadDoctors$ = createEffect(
  (actions$ = inject(Actions), api = inject(DoctorApiService)) =>
    actions$.pipe(
      ofType(A.loadDoctors),
      switchMap(({ active }) => api.list({ active, size: 100 }).pipe(
        map((page) => A.loadDoctorsSuccess({ doctors: page.content })),
        catchError((e) => of(A.doctorsFailure({ source: 'load', error: errorMessage(e) }))),
      )),
    ),
  { functional: true },
);

export const loadDoctor$ = createEffect(
  (actions$ = inject(Actions), api = inject(DoctorApiService)) =>
    actions$.pipe(
      ofType(A.loadDoctor),
      mergeMap(({ id }) => api.getById(id).pipe(
        map((doctor) => A.loadDoctorSuccess({ doctor })),
        catchError((e) => of(A.doctorsFailure({ source: 'load-one', error: errorMessage(e) }))),
      )),
    ),
  { functional: true },
);

export const createDoctor$ = createEffect(
  (actions$ = inject(Actions), api = inject(DoctorApiService)) =>
    actions$.pipe(
      ofType(A.createDoctor),
      exhaustMap(({ doctor }) => api.create(doctor).pipe(
        map((d) => A.createDoctorSuccess({ doctor: d })),
        catchError((e) => of(A.doctorsFailure({ source: 'create', error: errorMessage(e) }))),
      )),
    ),
  { functional: true },
);

export const updateDoctor$ = createEffect(
  (actions$ = inject(Actions), api = inject(DoctorApiService)) =>
    actions$.pipe(
      ofType(A.updateDoctor),
      concatMap(({ id, doctor }) => api.update(id, doctor).pipe(
        map((d) => A.updateDoctorSuccess({ doctor: d })),
        catchError((e) => of(A.doctorsFailure({ source: 'update', error: errorMessage(e) }))),
      )),
    ),
  { functional: true },
);

export const deactivateDoctor$ = createEffect(
  (actions$ = inject(Actions), api = inject(DoctorApiService)) =>
    actions$.pipe(
      ofType(A.deactivateDoctor),
      concatMap(({ id }) => api.deactivate(id).pipe(
        map(() => A.deactivateDoctorSuccess({ id })),
        catchError((e) => of(A.doctorsFailure({ source: 'deactivate', error: errorMessage(e) }))),
      )),
    ),
  { functional: true },
);

/** Non-dispatching effect: success toasts and failure toasts (no action is emitted). */
export const doctorToasts$ = createEffect(
  (actions$ = inject(Actions), notify = inject(NotificationService)) =>
    actions$.pipe(
      ofType(A.createDoctorSuccess, A.updateDoctorSuccess, A.deactivateDoctorSuccess, A.doctorsFailure),
      tap((a) => {
        switch (a.type) {
          case A.createDoctorSuccess.type: notify.success('Doctor registered'); break;
          case A.updateDoctorSuccess.type: notify.success('Doctor updated'); break;
          case A.deactivateDoctorSuccess.type: notify.success('Doctor deactivated'); break;
          case A.doctorsFailure.type: if ((a as ReturnType<typeof A.doctorsFailure>).source !== 'load-one') notify.error((a as ReturnType<typeof A.doctorsFailure>).error); break;
        }
      }),
    ),
  { functional: true, dispatch: false },
);

/** State persistence: save filter preferences whenever a filter action ran. */
export const persistDoctorFilters$ = createEffect(
  (actions$ = inject(Actions), store = inject(Store)) =>
    actions$.pipe(
      ofType(A.specializationChanged, A.departmentChanged, A.onlyActiveChanged, A.sortChanged, A.pageChanged, A.filtersReset),
      withLatestFrom(store.select(selectDoctorFilters)),
      tap(([, filters]) => persistFilters(filters)),
    ),
  { functional: true, dispatch: false },
);
