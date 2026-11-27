import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { catchError, concatMap, filter, map, mergeMap, of, switchMap, tap, withLatestFrom } from 'rxjs';
import { HospitalApiService } from '../../core/api/hospital-api.service';
import { errorMessage } from '../../core/models/api-error';
import { NotificationService } from '../../core/services/notification.service';
import { HospitalsActions as A } from '../actions/hospitals.actions';
import { selectAllHospitals } from '../selectors/hospitals.selectors';

@Injectable()
export class HospitalsEffects {
  private readonly actions$ = inject(Actions);
  private readonly api = inject(HospitalApiService);
  private readonly store = inject(Store);
  private readonly notify = inject(NotificationService);
  private readonly fail = (e: unknown) => of(A.failure({ error: errorMessage(e) }));

  /** withLatestFrom + filter: skip the request when hospitals are already in the store (cheap cache) unless `force`. */
  readonly load$ = createEffect(() => this.actions$.pipe(
    ofType(A.load),
    withLatestFrom(this.store.select(selectAllHospitals)),
    filter(([a, cached]) => !!a.force || cached.length === 0),
    switchMap(() => this.api.list().pipe(map((hospitals) => A.loadSuccess({ hospitals })), catchError((e) => of(A.loadFailure({ error: errorMessage(e) }))))),
  ));
  readonly loadDepartments$ = createEffect(() => this.actions$.pipe(ofType(A.loadDepartments), mergeMap(({ hospitalId }) => this.api.departments(hospitalId).pipe(map((departments) => A.loadDepartmentsSuccess({ hospitalId, departments })), catchError((e) => this.fail(e))))));
  readonly saveHospital$ = createEffect(() => this.actions$.pipe(ofType(A.saveHospital), concatMap(({ id, hospital }) => (id ? this.api.update(id, hospital) : this.api.create(hospital)).pipe(map((h) => A.saveHospitalSuccess({ hospital: h, created: !id })), catchError((e) => this.fail(e))))));
  readonly deactivate$ = createEffect(() => this.actions$.pipe(ofType(A.deactivateHospital), concatMap(({ id }) => this.api.deactivate(id).pipe(map(() => A.deactivateHospitalSuccess({ id })), catchError((e) => this.fail(e))))));
  readonly saveDepartment$ = createEffect(() => this.actions$.pipe(ofType(A.saveDepartment), concatMap(({ hospitalId, id, department }) => (id ? this.api.updateDepartment(id, department) : this.api.createDepartment(hospitalId, department)).pipe(map((d) => A.saveDepartmentSuccess({ department: d })), catchError((e) => this.fail(e))))));
  readonly deleteDepartment$ = createEffect(() => this.actions$.pipe(ofType(A.deleteDepartment), concatMap(({ id }) => this.api.deleteDepartment(id).pipe(map(() => A.deleteDepartmentSuccess({ id })), catchError((e) => this.fail(e))))));

  readonly toasts$ = createEffect(() => this.actions$.pipe(ofType(A.saveHospitalSuccess, A.deactivateHospitalSuccess, A.saveDepartmentSuccess, A.deleteDepartmentSuccess, A.failure), tap((a) => {
    if (a.type === A.failure.type) this.notify.error((a as { error: string }).error);
    else this.notify.success(a.type === A.saveHospitalSuccess.type ? 'Hospital saved' : a.type === A.deactivateHospitalSuccess.type ? 'Hospital deactivated' : a.type === A.saveDepartmentSuccess.type ? 'Department saved' : 'Department removed');
  })), { dispatch: false });
}
