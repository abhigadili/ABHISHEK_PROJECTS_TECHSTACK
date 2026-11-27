import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { catchError, concatMap, exhaustMap, forkJoin, map, mergeMap, of, switchMap, tap, delay } from 'rxjs';
import { AppointmentApiService } from '../../core/api/appointment-api.service';
import { ApiError, errorMessage } from '../../core/models/api-error';
import { EventBusService } from '../../core/services/event-bus.service';
import { NotificationService } from '../../core/services/notification.service';
import { AppointmentsActions as A } from '../actions/appointments.actions';

@Injectable()
export class AppointmentsEffects {
  private readonly actions$ = inject(Actions);
  private readonly api = inject(AppointmentApiService);
  private readonly notify = inject(NotificationService);
  private readonly bus = inject(EventBusService);

  /**
   * Feed loading: patient scope = one request; doctors scope (admin/doctor) = one request per doctor run in PARALLEL with
   * forkJoin and flattened. switchMap cancels a stale feed request when the scope changes.
   */
  readonly loadFeed$ = createEffect(() =>
    this.actions$.pipe(
      ofType(A.loadFeed),
      switchMap(({ scope }) => {
        const req$ = scope.kind === 'patient' ? this.api.forPatient(scope.patientId) : scope.doctorIds.length ? forkJoin(scope.doctorIds.map((id) => this.api.forDoctor(id))).pipe(map((lists) => lists.flat())) : of([]);
        return req$.pipe(map((appointments) => A.loadFeedSuccess({ appointments })), catchError((e) => of(A.loadFeedFailure({ error: errorMessage(e) }))));
      }),
    ));

  /** exhaustMap: while a booking request is in flight further "Book" actions are ignored (double-click / double-submit protection). */
  readonly book$ = createEffect(() =>
    this.actions$.pipe(
      ofType(A.book),
      exhaustMap(({ request }) => this.api.book(request).pipe(
        map((appointment) => A.bookSuccess({ appointment })),
        catchError((e) => of(A.bookFailure({ error: errorMessage(e), status: ApiError.from(e).status }))),
      )),
    ));

  /** concatMap: cancellations/reschedules/completions are processed one after another in the order the user triggered them. */
  readonly cancel$ = createEffect(() =>
    this.actions$.pipe(
      ofType(A.cancel),
      concatMap(({ id, reason }) => this.api.cancel(id, reason).pipe(map((appointment) => A.cancelSuccess({ appointment })), catchError((e) => of(A.cancelFailure({ id, error: errorMessage(e) }))))),
    ));
  readonly reschedule$ = createEffect(() =>
    this.actions$.pipe(
      ofType(A.reschedule),
      concatMap(({ id, request }) => this.api.reschedule(id, request).pipe(map((appointment) => A.rescheduleSuccess({ appointment })), catchError((e) => of(A.rescheduleFailure({ error: errorMessage(e) }))))),
    ));
  readonly complete$ = createEffect(() =>
    this.actions$.pipe(
      ofType(A.complete),
      concatMap(({ id, notes }) => this.api.complete(id, notes).pipe(map((appointment) => A.completeSuccess({ appointment })), catchError((e) => of(A.completeFailure({ error: errorMessage(e) }))))),
    ));

  /**
   * The bill and the e-mail are created asynchronously by Kafka consumers, so shortly after booking/cancelling the affected
   * appointment is re-read (mergeMap: independent refreshes may overlap) and merged with updateMany (statusesRefreshed).
   */
  readonly refreshAfterChange$ = createEffect(() =>
    this.actions$.pipe(
      ofType(A.bookSuccess, A.cancelSuccess),
      delay(2500),
      mergeMap((a) => this.api.getById(a.appointment.id).pipe(map((appointment) => A.statusesRefreshed({ appointments: [appointment] })), catchError(() => of(A.statusesRefreshed({ appointments: [] }))))),
    ));

  /** Non-dispatching: toasts + application event bus (Subject communication to the notification/activity feed). */
  readonly sideEffects$ = createEffect(() =>
    this.actions$.pipe(
      ofType(A.bookSuccess, A.cancelSuccess, A.rescheduleSuccess, A.completeSuccess, A.cancelFailure, A.rescheduleFailure, A.completeFailure),
      tap((a) => {
        switch (a.type) {
          case A.bookSuccess.type: this.notify.success('Appointment booked'); this.bus.emit({ type: 'appointment-changed', appointmentId: (a as ReturnType<typeof A.bookSuccess>).appointment.id, status: 'BOOKED' }); break;
          case A.cancelSuccess.type: this.notify.success('Appointment cancelled'); this.bus.emit({ type: 'appointment-changed', appointmentId: (a as ReturnType<typeof A.cancelSuccess>).appointment.id, status: 'CANCELLED' }); break;
          case A.rescheduleSuccess.type: this.notify.success('Appointment rescheduled'); break;
          case A.completeSuccess.type: this.notify.success('Appointment marked as completed'); break;
          default: this.notify.error((a as { error: string }).error);
        }
      }),
    ), { dispatch: false });
}
