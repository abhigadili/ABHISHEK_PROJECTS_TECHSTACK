import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { RouterLink } from '@angular/router';
import { BehaviorSubject, combineLatest, map, of, switchMap } from 'rxjs';
import { PrescriptionApiService } from '../../core/api/prescription-api.service';
import { AuthService } from '../../core/auth/auth.service';
import type { LoadState } from '../../core/models/api-error';
import type { Patient, Prescription } from '../../core/models';
import { CurrentIdentityService } from '../../core/services/current-identity.service';
import { DataStateComponent, NoticeComponent, PageHeaderComponent, PatientPickerComponent } from '../../shared/components';
import { toLoadState } from '../../shared/utilities/load-state';

/**
 * Prescription history. The backend lists by patient or by doctor only (no list-all):
 *   PATIENT → own prescriptions · DOCTOR → prescriptions they issued · ADMIN / PHARMACIST → choose a patient.
 */
@Component({
  selector: 'app-prescription-list',
  standalone: true,
  imports: [DatePipe, RouterLink, MatButtonModule, PageHeaderComponent, PatientPickerComponent, DataStateComponent, NoticeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header title="Prescriptions" [subtitle]="subtitle()">
      @if (auth.can('prescriptions:create')) { <a actions mat-flat-button color="primary" routerLink="new">New prescription</a> }
    </app-page-header>
    @if (auth.role() === 'ADMIN' || auth.role() === 'PHARMACIST') {
      <div class="mb-4 max-w-xl rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"><p class="mb-2 text-sm text-slate-500">Prescriptions are listed per patient – pick one.</p><app-patient-picker [(patient)]="picked" /></div>
    }
    @if (auth.role() === 'DOCTOR' && noDoctor()) { <app-notice tone="warning" heading="No doctor profile">Your login is not linked to a doctor profile, so there is no prescription history to show.</app-notice> }
    @else if (source() !== 'none') {
      <app-data-state [state]="state()" emptyTitle="No prescriptions" (retry)="reload$.next()">
        <ng-template #loaded let-rows>
          <div class="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"><table class="w-full text-sm">
            <thead><tr class="border-b text-left text-xs uppercase text-slate-500"><th class="p-3">Rx</th><th>Patient</th><th>Doctor</th><th>Diagnosis</th><th>Items</th><th>Issued</th><th>Status</th></tr></thead>
            <tbody>@for (p of sorted(rows); track p.id) { <tr class="border-b last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800"><td class="p-3"><a [routerLink]="[p.id]" class="font-semibold">#{{ p.id }}</a></td><td>{{ p.patientName }}</td><td>{{ p.doctorName }}</td><td class="max-w-[16rem] truncate">{{ p.diagnosis ?? '—' }}</td><td>{{ p.items.length }}</td><td>{{ p.issuedAt | date: 'dd MMM yyyy' }}</td><td><span class="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold dark:bg-slate-800">{{ p.status }}</span></td></tr> }</tbody></table></div>
        </ng-template>
      </app-data-state>
    }`,
})
export class PrescriptionListComponent {
  protected readonly auth = inject(AuthService);
  private readonly api = inject(PrescriptionApiService);
  private readonly doctor = toSignal(inject(CurrentIdentityService).doctor$);
  private readonly patient = toSignal(inject(CurrentIdentityService).patient$);
  protected readonly picked = signal<Patient | null>(null);
  protected readonly reload$ = new BehaviorSubject<void>(undefined);
  protected readonly noDoctor = computed(() => this.doctor() === null);
  protected readonly source = computed<'patient' | 'doctor' | 'picked' | 'none'>(() => {
    const r = this.auth.role();
    if (r === 'PATIENT') return this.patient() ? 'patient' : 'none';
    if (r === 'DOCTOR') return this.doctor() ? 'doctor' : 'none';
    return this.picked() ? 'picked' : 'none';
  });
  protected readonly subtitle = computed(() => ({ patient: 'Your prescriptions', doctor: 'Prescriptions you issued', picked: `For ${this.picked()?.firstName ?? ''} ${this.picked()?.lastName ?? ''}`, none: 'History' })[this.source()]);
  /** combineLatest(source, reload) → switchMap cancels a stale request when the patient changes. */
  protected readonly state = toSignal(
    combineLatest([toObservable(this.source), toObservable(computed(() => this.patient()?.id ?? this.picked()?.id ?? 0)), toObservable(computed(() => this.doctor()?.id ?? 0)), this.reload$]).pipe(
      switchMap(([src, pid, did]) => toLoadState(src === 'doctor' ? this.api.forDoctor(did) : src === 'none' ? of([] as Prescription[]) : this.api.forPatient(pid))),
      map((s): LoadState<Prescription[]> => s),
    ), { initialValue: { status: 'loading' } as LoadState<Prescription[]> });
  protected sorted(rows: Prescription[]) { return [...rows].sort((a, b) => b.issuedAt.localeCompare(a.issuedAt)); }
}
