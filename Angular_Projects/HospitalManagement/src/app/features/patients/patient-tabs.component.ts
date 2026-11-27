import { CurrencyPipe, DatePipe, TitleCasePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { filter, forkJoin, map, of, switchMap, catchError } from 'rxjs';
import { AppointmentApiService } from '../../core/api/appointment-api.service';
import { BillingApiService } from '../../core/api/billing-api.service';
import { LaboratoryApiService } from '../../core/api/laboratory-api.service';
import { MedicalRecordApiService } from '../../core/api/medical-record-api.service';
import { PrescriptionApiService } from '../../core/api/prescription-api.service';
import { AuthService } from '../../core/auth/auth.service';
import { DataStateComponent } from '../../shared/components';
import { AppointmentStatusPipe, BillingAmountPipe, MedicineInfoPipe, RecordDatePipe } from '../../shared/pipes/pipes';
import { toLoadState } from '../../shared/utilities/load-state';
import { PatientContextService } from './patient-context.service';
import { ageFromDob } from '../../shared/utilities/helpers';

/** Shared plumbing of the tabs: patient id from the component-level PatientContextService → switchMap → LoadState. */
abstract class PatientTab {
  protected readonly ctx = inject(PatientContextService);
  protected readonly id$ = toObservable(this.ctx.id).pipe(filter((id) => id > 0));
}

@Component({
  selector: 'app-patient-overview',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (ctx.patient(); as p) {
      <div class="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        @for (c of counts(); track c.label) { <a [routerLink]="c.to" class="rounded-xl border border-slate-200 bg-white p-4 no-underline hover:border-brand-500 dark:border-slate-700 dark:bg-slate-900"><div class="text-xs font-semibold uppercase text-slate-500">{{ c.label }}</div><div class="text-2xl font-bold">{{ c.value ?? '…' }}</div></a> }
      </div>
      <dl class="grid gap-4 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-2 lg:grid-cols-3 dark:border-slate-700 dark:bg-slate-900">
        @for (f of facts(p); track f[0]) { <div><dt class="text-xs font-semibold uppercase tracking-wide text-slate-500">{{ f[0] }}</dt><dd class="text-sm break-words">{{ f[1] || '—' }}</dd></div> }
      </dl>
    }`,
})
export class PatientOverviewComponent extends PatientTab {
  private readonly auth = inject(AuthService);
  private readonly appts = inject(AppointmentApiService);
  private readonly rx = inject(PrescriptionApiService);
  private readonly lab = inject(LaboratoryApiService);
  private readonly bills = inject(BillingApiService);
  /** FORKJOIN: four independent requests in parallel; a failing/forbidden one yields null instead of failing the whole card row. */
  protected readonly counts = toSignal(this.id$.pipe(
    switchMap((id) => forkJoin({
      a: this.auth.can('appointments:manage') ? this.appts.forPatient(id).pipe(map((x) => x.length), catchError(() => of(null))) : of(null),
      r: this.auth.can('prescriptions:read') ? this.rx.forPatient(id).pipe(map((x) => x.length), catchError(() => of(null))) : of(null),
      l: this.auth.can('lab:read') ? this.lab.requestsForPatient(id).pipe(map((x) => x.length), catchError(() => of(null))) : of(null),
      b: this.auth.can('billing:read') ? this.bills.forPatient(id).pipe(map((x) => x.length), catchError(() => of(null))) : of(null),
    })),
    map((c) => [{ label: 'Appointments', value: c.a, to: '../appointments' }, { label: 'Prescriptions', value: c.r, to: '../prescriptions' }, { label: 'Lab requests', value: c.l, to: '../lab-reports' }, { label: 'Invoices', value: c.b, to: '../billing' }]),
  ), { initialValue: [] as { label: string; value: number | null; to: string }[] });
  protected facts(p: NonNullable<ReturnType<PatientContextService['patient']>>): [string, string | number | null][] {
    return [['Date of birth', `${p.dateOfBirth} (${ageFromDob(p.dateOfBirth) ?? '—'} y)`], ['Gender', p.gender], ['Blood group', p.bloodGroup], ['Identity number', p.identityNumber], ['E-mail', p.email], ['Phone', p.phone], ['Address', p.address], ['Emergency contact', p.emergencyContactName], ['Emergency phone', p.emergencyContactPhone], ['Known allergies', p.knownAllergies], ['Registered', p.createdAt?.slice(0, 10)]];
  }
}

@Component({
  selector: 'app-patient-appointments',
  standalone: true,
  imports: [DatePipe, RouterLink, DataStateComponent, AppointmentStatusPipe, CurrencyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<app-data-state [state]="state()" emptyTitle="No appointments yet" emptyDescription="Appointments booked for this patient appear here.">
    <ng-template #loaded let-rows>
      <table class="w-full overflow-hidden rounded-xl border border-slate-200 bg-white text-sm dark:border-slate-700 dark:bg-slate-900"><thead><tr class="border-b text-left text-xs uppercase text-slate-500"><th class="p-3">Date</th><th>Time</th><th>Doctor</th><th>Reason</th><th>Status</th><th class="pr-3 text-right">Fee</th></tr></thead>
        <tbody>@for (a of rows; track a.id) { <tr class="border-b last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800"><td class="p-3"><a [routerLink]="['/appointments', a.id]" class="font-semibold text-brand-600">{{ a.date | date: 'dd MMM yyyy' }}</a></td><td>{{ a.startTime }}–{{ a.endTime }}</td><td>{{ a.doctorName }}</td><td>{{ a.reason ?? '—' }}</td><td><span class="rounded-full px-2 py-0.5 text-xs font-semibold" [class]="a.status | appointmentStatus: 'classes'">{{ a.status | appointmentStatus }}</span></td><td class="pr-3 text-right">{{ a.fee | currency: 'INR' }}</td></tr> }</tbody></table>
    </ng-template></app-data-state>`,
})
export class PatientAppointmentsComponent extends PatientTab {
  private readonly api = inject(AppointmentApiService);
  protected readonly state = toSignal(this.id$.pipe(switchMap((id) => toLoadState(this.api.forPatient(id).pipe(map((l) => [...l].sort((a, b) => (b.date + b.startTime).localeCompare(a.date + a.startTime))))))), { initialValue: { status: 'loading' as const } });
}

@Component({
  selector: 'app-patient-prescriptions',
  standalone: true,
  imports: [DatePipe, RouterLink, DataStateComponent, MedicineInfoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<app-data-state [state]="state()" emptyTitle="No prescriptions" emptyDescription="Prescriptions issued by doctors appear here.">
    <ng-template #loaded let-rows><ul class="space-y-3">@for (r of rows; track r.id) { <li class="rounded-xl border border-slate-200 bg-white p-4 text-sm dark:border-slate-700 dark:bg-slate-900"><div class="flex justify-between"><a [routerLink]="['/prescriptions', r.id]" class="font-semibold text-brand-600">Rx #{{ r.id }}</a><span class="text-slate-500">{{ r.issuedAt | date: 'dd MMM yyyy' }} · {{ r.status }}</span></div><div class="text-slate-500">{{ r.doctorName }} · {{ r.diagnosis ?? '—' }}</div><ul class="mt-1 list-disc pl-5">@for (i of r.items; track i.id) { <li>{{ i | medicineInfo }}</li> }</ul></li> }</ul></ng-template></app-data-state>`,
})
export class PatientPrescriptionsComponent extends PatientTab {
  private readonly api = inject(PrescriptionApiService);
  protected readonly state = toSignal(this.id$.pipe(switchMap((id) => toLoadState(this.api.forPatient(id)))), { initialValue: { status: 'loading' as const } });
}

@Component({
  selector: 'app-patient-lab',
  standalone: true,
  imports: [DatePipe, RouterLink, DataStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<app-data-state [state]="state()" emptyTitle="No lab tests requested">
    <ng-template #loaded let-rows><table class="w-full overflow-hidden rounded-xl border border-slate-200 bg-white text-sm dark:border-slate-700 dark:bg-slate-900"><thead><tr class="border-b text-left text-xs uppercase text-slate-500"><th class="p-3">Accession</th><th>Test</th><th>Requested</th><th>Status</th></tr></thead>
      <tbody>@for (r of rows; track r.id) { <tr class="border-b last:border-0"><td class="p-3 font-mono text-xs">{{ r.accessionNumber ?? 'pending' }}</td><td><a [routerLink]="['/lab/requests', r.id]" class="font-semibold text-brand-600">{{ r.testName }}</a></td><td>{{ r.requestedAt | date: 'dd MMM yyyy, HH:mm' }}</td><td>{{ r.status }}</td></tr> }</tbody></table></ng-template></app-data-state>`,
})
export class PatientLabComponent extends PatientTab {
  private readonly api = inject(LaboratoryApiService);
  protected readonly state = toSignal(this.id$.pipe(switchMap((id) => toLoadState(this.api.requestsForPatient(id)))), { initialValue: { status: 'loading' as const } });
}

@Component({
  selector: 'app-patient-billing',
  standalone: true,
  imports: [DatePipe, RouterLink, DataStateComponent, BillingAmountPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<app-data-state [state]="state()" emptyTitle="No invoices">
    <ng-template #loaded let-rows><table class="w-full overflow-hidden rounded-xl border border-slate-200 bg-white text-sm dark:border-slate-700 dark:bg-slate-900"><thead><tr class="border-b text-left text-xs uppercase text-slate-500"><th class="p-3">Invoice</th><th>Due</th><th class="text-right">Total</th><th class="text-right">Balance</th><th class="pr-3">Status</th></tr></thead>
      <tbody>@for (b of rows; track b.id) { <tr class="border-b last:border-0"><td class="p-3"><a [routerLink]="['/billing/invoices', b.id]" class="font-semibold text-brand-600">{{ b.billNumber }}</a></td><td>{{ b.dueDate | date: 'dd MMM yyyy' }}</td><td class="text-right">{{ b | billingAmount }}</td><td class="text-right">{{ b | billingAmount: 'due' }}</td><td class="pr-3">{{ b.status }}</td></tr> }</tbody></table></ng-template></app-data-state>`,
})
export class PatientBillingComponent extends PatientTab {
  private readonly api = inject(BillingApiService);
  protected readonly state = toSignal(this.id$.pipe(switchMap((id) => toLoadState(this.api.forPatient(id)))), { initialValue: { status: 'loading' as const } });
}

@Component({
  selector: 'app-patient-history',
  standalone: true,
  imports: [RouterLink, DataStateComponent, RecordDatePipe, TitleCasePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<app-data-state [state]="state()" emptyTitle="No medical record">
    <ng-template #loaded let-s><div class="mb-3 flex flex-wrap gap-2 text-xs">@for (e of entries(s); track e[0]) { <span class="rounded-full bg-slate-100 px-3 py-1 dark:bg-slate-800">{{ e[0] | titlecase }}: <b>{{ e[1] }}</b></span> }</div>
      <p class="mb-3 rounded-lg bg-sky-50 p-3 text-sm dark:bg-sky-950/40"><b>Chronic conditions:</b> {{ s.chronicConditions ?? 'none recorded' }}</p>
      <ul class="space-y-2">@for (e of s.latestEntries; track e.id) { <li class="rounded-lg border border-slate-200 bg-white p-3 text-sm dark:border-slate-700 dark:bg-slate-900"><a [routerLink]="['/records/entries', e.id]" class="font-semibold text-brand-600">{{ e.title }}</a><div class="text-xs text-slate-500">{{ e.entryType }} · {{ e.recordedAt | recordDate }}</div></li> }</ul>
      <a [routerLink]="['/records/patients', ctx.id()]" class="mt-3 inline-block text-sm font-semibold text-brand-600">Open full medical record →</a></ng-template></app-data-state>`,
})
export class PatientHistoryComponent extends PatientTab {
  private readonly api = inject(MedicalRecordApiService);
  protected readonly state = toSignal(this.id$.pipe(switchMap((id) => toLoadState(this.api.summary(id)))), { initialValue: { status: 'loading' as const } });
  protected entries(s: { entryCounts: Record<string, number> }) { return Object.entries(s.entryCounts); }
}
