import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Actions, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { filter, of, startWith, switchMap, take } from 'rxjs';
import { AppointmentApiService } from '../../core/api/appointment-api.service';
import type { Appointment } from '../../core/models';
import type { HasUnsavedChanges } from '../../core/guards/unsaved-changes.guard';
import { AppointmentsActions } from '../../state/actions/appointments.actions';
import { DataStateComponent, NoticeComponent, PageHeaderComponent, SlotPickerComponent } from '../../shared/components';
import { futureOrTodayValidator } from '../../shared/validators/validators';
import { todayISO } from '../../shared/utilities/helpers';
import { toLoadState } from '../../shared/utilities/load-state';

/** Appointment rescheduling (typed Reactive Form): dependent requests appointment → (doctor, new date) → live slots; NgRx `reschedule` (concatMap effect). */
@Component({
  selector: 'app-appointment-reschedule',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, DatePipe, PageHeaderComponent, DataStateComponent, SlotPickerComponent, NoticeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mx-auto max-w-3xl space-y-4"><app-page-header title="Reschedule appointment" />
      <app-data-state [state]="appt()"><ng-template #loaded let-a>
        @if (a.status !== 'BOOKED') { <app-notice tone="warning" heading="Not reschedulable">Only booked appointments can be rescheduled; this one is {{ a.status.toLowerCase() }}.</app-notice> }
        @else {
          <p class="rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-800">{{ a.patientName }} with {{ a.doctorName }} · currently <b>{{ a.date | date: 'dd MMM yyyy' }} {{ a.startTime }}</b></p>
          <form [formGroup]="form" (ngSubmit)="submit(a)" novalidate class="mt-4 space-y-4 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900" aria-label="Reschedule form">
            <label class="text-xs font-medium text-slate-500">New date<input type="date" formControlName="date" [min]="today" class="mt-1 block h-9 rounded-md border border-slate-300 bg-transparent px-2 text-sm text-inherit dark:border-slate-600" /></label>
            @if (form.controls.date.errors?.['futureDate']) { <p class="text-xs text-red-600">{{ form.controls.date.errors?.['futureDate'] }}</p> }
            @if (slotsLoading()) { <p class="text-sm text-slate-500">Loading slots…</p> } @else { <app-slot-picker [slots]="slots()" [(selected)]="time" /> }
            @if (error()) { <p role="alert" class="rounded-md bg-red-50 p-3 text-sm text-red-800">{{ error() }}</p> }
            <div class="flex justify-end gap-2"><a [routerLink]="['/appointments', a.id]" class="rounded-md border border-slate-300 px-4 py-2 text-sm no-underline dark:border-slate-600">Back</a><button type="submit" class="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" [disabled]="!time() || busy() || form.invalid">{{ busy() ? 'Saving…' : 'Confirm new time' }}</button></div>
          </form>
        }
      </ng-template></app-data-state></div>`,
})
export class AppointmentRescheduleComponent implements HasUnsavedChanges {
  readonly appointmentId = input.required<string>();
  private readonly api = inject(AppointmentApiService);
  private readonly store = inject(Store);
  private readonly actions$ = inject(Actions);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly today = todayISO();
  protected readonly form = inject(NonNullableFormBuilder).group({ date: [todayISO(), [Validators.required, futureOrTodayValidator]] });
  protected readonly appt = toSignal(toObservable(computed(() => Number(this.appointmentId()))).pipe(filter((i) => i > 0), switchMap((id) => toLoadState(this.api.getById(id)))), { initialValue: { status: 'loading' as const } });
  private readonly date = toSignal(this.form.controls.date.valueChanges.pipe(startWith(this.form.controls.date.value)), { initialValue: todayISO() });
  private readonly doctorId = computed(() => { const a = this.appt(); return a.status === 'loaded' ? a.data.doctorId : 0; });
  private readonly slotState = toSignal(toObservable(computed(() => [this.doctorId(), this.date()] as const)).pipe(switchMap(([id, d]) => (id && d && this.form.controls.date.valid ? toLoadState(this.api.availability(id, d)) : of({ status: 'loaded', data: [] } as const)))), { initialValue: { status: 'loading' as const } });
  protected readonly slots = computed(() => { const s = this.slotState(); return s.status === 'loaded' ? s.data : []; });
  protected readonly slotsLoading = computed(() => this.slotState().status === 'loading');
  /** linkedSignal: resets whenever the date or doctor changes. */
  protected readonly time = linkedSignal<readonly [number, string], string | null>({ source: () => [this.doctorId(), this.date()] as const, computation: () => null });
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  private saved = false;

  protected submit(a: Appointment): void {
    if (!this.time()) return;
    this.busy.set(true); this.error.set(null);
    this.actions$.pipe(ofType(AppointmentsActions.rescheduleSuccess, AppointmentsActions.rescheduleFailure), take(1), takeUntilDestroyed(this.destroyRef)).subscribe((r) => {
      this.busy.set(false);
      if (r.type === AppointmentsActions.rescheduleSuccess.type) { this.saved = true; void this.router.navigate(['/appointments', a.id]); } else { this.error.set((r as { error: string }).error); this.time.set(null); }
    });
    this.store.dispatch(AppointmentsActions.reschedule({ id: a.id, request: { date: this.date(), startTime: this.time()! } }));
  }
  hasUnsavedChanges(): boolean { return !this.saved && !!this.time(); }
}
