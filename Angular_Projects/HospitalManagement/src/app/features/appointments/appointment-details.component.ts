import { DatePipe, JsonPipe, KeyValuePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { Store } from '@ngrx/store';
import { filter, map, of, switchMap } from 'rxjs';
import { Router } from '@angular/router';
import { AppointmentApiService } from '../../core/api/appointment-api.service';
import { AuthService } from '../../core/auth/auth.service';
import { AppointmentsActions } from '../../state/actions/appointments.actions';
import { selectAppointmentEntities } from '../../state/selectors/appointments.selectors';
import { ConfirmService, DataStateComponent, PageHeaderComponent } from '../../shared/components';
import { HasPermissionDirective } from '../../shared/directives/directives';
import { countdown$ } from '../../shared/utilities/countdown';
import { toLoadState } from '../../shared/utilities/load-state';
import { AppointmentSummaryComponent } from './appointment-summary.component';
import { LifecycleLogService } from './lifecycle-log.service';

/**
 * Appointment details. `appointmentId` is bound from the route parameter (component input binding). The appointment is read from the NgRx
 * entity map when it is already loaded (selector) and fetched from the API otherwise – then upserted into the store.
 * Contains the lifecycle inspector: the summary card logs all eight hooks and this page shows them (KeyValuePipe/JsonPipe for the counters).
 */
@Component({
  selector: 'app-appointment-details',
  standalone: true,
  imports: [DatePipe, KeyValuePipe, JsonPipe, RouterLink, PageHeaderComponent, DataStateComponent, AppointmentSummaryComponent, HasPermissionDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mx-auto max-w-3xl space-y-4">
      <app-page-header title="Appointment details" />
      <app-data-state [state]="state()">
        <ng-template #loaded let-a>
          <app-appointment-summary [appointment]="a">
            @if (a.notes || a.cancelReason || a.reason) {
              <div #note class="space-y-1 rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-800">
                @if (a.reason) { <p><b>Reason:</b> {{ a.reason }}</p> }@if (a.notes) { <p><b>Doctor's notes:</b> {{ a.notes }}</p> }@if (a.cancelReason) { <p class="text-red-700"><b>Cancelled:</b> {{ a.cancelReason }}</p> }
              </div>
            }
          </app-appointment-summary>
          @if (startsIn()) { <p class="mt-3 text-sm text-slate-500" aria-live="polite">Starts in <b>{{ startsIn() }}</b></p> }
          <div class="mt-4 flex flex-wrap gap-2">
            @if (a.status === 'BOOKED') {
              <a [routerLink]="['reschedule']" class="rounded-md border border-slate-300 px-4 py-2 text-sm no-underline dark:border-slate-600">Reschedule</a>
              <button class="rounded-md border border-red-300 px-4 py-2 text-sm text-red-700" (click)="cancel(a.id)">Cancel appointment</button>
              <button *appHasPermission="'appointments:complete'" class="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white" (click)="complete(a.id)">Mark completed</button>
            }
            @if (a.status !== 'CANCELLED') {
              <a *appHasPermission="'prescriptions:create'" [routerLink]="['/prescriptions/new']" [queryParams]="{ patientId: a.patientId, doctorId: a.doctorId, appointmentId: a.id }" class="rounded-md border border-slate-300 px-4 py-2 text-sm no-underline dark:border-slate-600">Write prescription</a>
              <a *appHasPermission="'lab:request'" [routerLink]="['/lab/requests/new']" [queryParams]="{ patientId: a.patientId, doctorId: a.doctorId, appointmentId: a.id }" class="rounded-md border border-slate-300 px-4 py-2 text-sm no-underline dark:border-slate-600">Request lab test</a>
            }
            <a [routerLink]="['/doctors', a.doctorId]" class="px-3 py-2 text-sm text-brand-600 no-underline">Doctor profile</a>
          </div>
        </ng-template>
      </app-data-state>
      <details class="rounded-xl border border-slate-200 bg-white p-4 text-sm dark:border-slate-700 dark:bg-slate-900">
        <summary class="cursor-pointer font-semibold">Lifecycle inspector (component hooks)</summary>
        <p class="my-2 text-xs text-slate-500">Hook calls of the summary card, newest last. ngDoCheck / *Checked hooks run on every change-detection pass, so only the first call and every 25th are listed.</p>
        <ol class="max-h-56 overflow-auto font-mono text-xs">@for (e of lifecycle.entries(); track $index) { <li>{{ e.at | date: 'HH:mm:ss.SSS' }} · <b>{{ e.component }}.{{ e.hook }}</b> {{ e.detail ?? '' }}</li> }</ol>
        <p class="mt-2 text-xs text-slate-500">Counters: {{ counters() | json }}</p>
        <ul class="hidden">@for (kv of counters() | keyvalue; track kv.key) { <li>{{ kv.key }}={{ kv.value }}</li> }</ul>
      </details>
    </div>`,
})
export class AppointmentDetailsComponent {
  readonly appointmentId = input.required<string>();
  protected readonly lifecycle = inject(LifecycleLogService);
  private readonly api = inject(AppointmentApiService);
  private readonly store = inject(Store);
  private readonly confirmDialog = inject(ConfirmService);
  private readonly router = inject(Router);
  protected readonly auth = inject(AuthService);
  private readonly entities = this.store.selectSignal(selectAppointmentEntities);
  private readonly id = computed(() => Number(this.appointmentId()));

  /** Store first (selector), API second: switchMap over the id; result is upserted into the NgRx entity collection. */
  protected readonly state = toSignal(toObservable(this.id).pipe(
    filter((id) => id > 0),
    switchMap((id) => toLoadState(this.api.getById(id))),
    map((s) => { const fromStore = s.status === 'loading' ? this.entities()[this.id()] : undefined; return fromStore ? ({ status: 'loaded', data: fromStore } as const) : s; }),
  ), { initialValue: { status: 'loading' as const } });
  /** interval + takeWhile countdown for BOOKED appointments (see shared/utilities/countdown.ts). */
  protected readonly startsIn = toSignal(toObservable(this.state).pipe(switchMap((s) => (s.status === 'loaded' && s.data.status === 'BOOKED' ? countdown$(new Date(`${s.data.date}T${s.data.startTime.slice(0, 5)}:00`)) : of('')))), { initialValue: '' });
  protected readonly counters = computed(() => { this.lifecycle.entries(); return Object.fromEntries(['ngOnChanges', 'ngOnInit', 'ngDoCheck', 'ngAfterContentInit', 'ngAfterContentChecked', 'ngAfterViewInit', 'ngAfterViewChecked', 'ngOnDestroy'].map((h) => [h, this.lifecycle.counter('AppointmentSummary', h)])); });
  private readonly changed = signal(0);

  constructor() { effect(() => { const s = this.state(); if (s.status === 'loaded') this.store.dispatch(AppointmentsActions.statusesRefreshed({ appointments: [s.data] })); }); void this.changed; }
  protected cancel(id: number) { this.confirmDialog.confirm({ title: 'Cancel this appointment?', message: 'The slot is released and an unpaid consultation bill is cancelled.', confirmLabel: 'Cancel appointment', destructive: true, askReason: true }).subscribe((r) => { if (r.confirmed) { this.store.dispatch(AppointmentsActions.cancel({ id, reason: r.reason })); void this.router.navigate(['/appointments']); } }); }
  protected complete(id: number) { this.confirmDialog.confirm({ title: 'Mark as completed?', message: 'Only possible once the appointment time has started.', confirmLabel: 'Mark completed', askReason: true, reasonLabel: 'Doctor notes (optional)' }).subscribe((r) => { if (r.confirmed) this.store.dispatch(AppointmentsActions.complete({ id, notes: r.reason })); }); }
}
