import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { catchError, concatMap, exhaustMap, map, of, switchMap, tap } from 'rxjs';
import { PatientApiService } from '../../core/api/patient-api.service';
import { errorMessage } from '../../core/models/api-error';
import { NotificationService } from '../../core/services/notification.service';
import { PatientsActions as A } from '../actions/patients.actions';

/** CLASS-BASED effects (the alternative to the functional style used for doctors). */
@Injectable()
export class PatientsEffects {
  private readonly actions$ = inject(Actions);
  private readonly api = inject(PatientApiService);
  private readonly notify = inject(NotificationService);

  /** switchMap: typing/paging fast cancels the superseded request. */
  readonly loadPage$ = createEffect(() =>
    this.actions$.pipe(
      ofType(A.loadPage),
      switchMap(({ q, page, size }) => this.api.list({ q: q || undefined, page, size }).pipe(
        map((result) => A.loadPageSuccess({ result, q })),
        catchError((e) => of(A.loadPageFailure({ error: errorMessage(e) }))),
      )),
    ));

  /** After a page loaded, quietly prefetch the next one into the entity map (upsertMany). */
  readonly prefetch$ = createEffect(() =>
    this.actions$.pipe(
      ofType(A.prefetchNext),
      switchMap(({ q, page, size }) => this.api.list({ q: q || undefined, page, size }).pipe(
        map((r) => A.prefetchNextSuccess({ patients: r.content })),
        catchError(() => of(A.prefetchNextSuccess({ patients: [] }))),
      )),
    ));

  readonly loadOne$ = createEffect(() =>
    this.actions$.pipe(
      ofType(A.loadOne),
      concatMap(({ id }) => this.api.getById(id).pipe(map((patient) => A.loadOneSuccess({ patient })), catchError((e) => of(A.saveFailure({ error: errorMessage(e) }))))),
    ));

  readonly create$ = createEffect(() =>
    this.actions$.pipe(
      ofType(A.create),
      exhaustMap(({ patient }) => this.api.create(patient).pipe(map((p) => A.createSuccess({ patient: p })), catchError((e) => of(A.saveFailure({ error: errorMessage(e) }))))),
    ));

  readonly update$ = createEffect(() =>
    this.actions$.pipe(
      ofType(A.update),
      concatMap(({ id, patient }) => this.api.update(id, patient).pipe(map((p) => A.updateSuccess({ patient: p })), catchError((e) => of(A.saveFailure({ error: errorMessage(e) }))))),
    ));

  readonly deactivate$ = createEffect(() =>
    this.actions$.pipe(
      ofType(A.deactivate),
      concatMap(({ id }) => this.api.deactivate(id).pipe(map(() => A.deactivateSuccess({ id })), catchError((e) => of(A.saveFailure({ error: errorMessage(e) }))))),
    ));

  readonly toasts$ = createEffect(() =>
    this.actions$.pipe(
      ofType(A.updateSuccess, A.deactivateSuccess, A.saveFailure),
      tap((a) => (a.type === A.saveFailure.type ? this.notify.error((a as { error: string }).error) : this.notify.success(a.type === A.updateSuccess.type ? 'Patient updated' : 'Patient deactivated'))),
    ), { dispatch: false });
}
