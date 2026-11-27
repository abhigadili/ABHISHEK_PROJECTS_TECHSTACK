import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { Prescription } from '../../core/models';
import { MedicineInfoPipe } from '../../shared/pipes/pipes';

/** Presentational prescription document (content projection `[actions]` slot for buttons). */
@Component({
  selector: 'app-prescription-view',
  standalone: true,
  imports: [DatePipe, RouterLink, MedicineInfoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let p = prescription();
    <article class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900" [attr.aria-label]="'Prescription ' + p.id">
      <header class="flex flex-wrap items-start justify-between gap-3 border-b pb-4"><div><div class="text-xs font-semibold uppercase tracking-widest text-slate-500">Prescription</div><h2 class="text-2xl font-bold">Rx #{{ p.id }}</h2><p class="text-sm text-slate-500">Issued {{ p.issuedAt | date: 'dd MMM yyyy, HH:mm' }} · valid until {{ p.validUntil | date: 'dd MMM yyyy' }}</p></div>
        <span class="rounded-full px-3 py-1 text-xs font-semibold" [class]="statusClass(p.status)">{{ status() ?? p.status }}</span></header>
      <div class="grid gap-4 py-4 text-sm sm:grid-cols-2"><div><div class="text-xs text-slate-500">Patient</div><a [routerLink]="['/patients', p.patientId]" class="font-semibold">{{ p.patientName }}</a> <span class="text-slate-500">#{{ p.patientId }}</span></div>
        <div><div class="text-xs text-slate-500">Prescribed by</div><a [routerLink]="['/doctors', p.doctorId]" class="font-semibold">{{ p.doctorName }}</a>@if (p.appointmentId) { · <a [routerLink]="['/appointments', p.appointmentId]" class="text-brand-600">appointment #{{ p.appointmentId }}</a> }</div></div>
      @if (p.diagnosis || p.notes) { <div class="mb-4 rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-800">@if (p.diagnosis) { <p><b>Diagnosis:</b> {{ p.diagnosis }}</p> }@if (p.notes) { <p><b>Notes:</b> {{ p.notes }}</p> }</div> }
      <table class="w-full text-sm"><thead><tr class="border-b text-left text-xs uppercase text-slate-500"><th class="pb-2">#</th><th>Medicine</th><th>Dosage</th><th>Frequency</th><th>Duration</th><th class="text-right">Qty</th></tr></thead>
        <tbody>@for (i of p.items; track i.id; let n = $index) { <tr class="border-b last:border-0" [title]="i | medicineInfo"><td class="py-2 text-slate-500">{{ n + 1 }}</td><td class="font-semibold">{{ i.medicineName }}@if (i.instructions) { <div class="text-xs font-normal text-slate-500">{{ i.instructions }}</div> }</td><td>{{ i.dosage }}</td><td>{{ i.frequency }}</td><td>{{ i.durationDays }} d</td><td class="text-right">{{ i.quantity }}</td></tr> }</tbody></table>
      <footer class="no-print mt-5 flex flex-wrap gap-2 border-t pt-4 empty:hidden"><ng-content select="[actions]" /></footer>
    </article>`,
})
export class PrescriptionViewComponent {
  readonly prescription = input.required<Prescription>();
  /** Live status polled from GET /prescriptions/{id}/status (overrides the stored one when it differs). */
  readonly status = input<string | null>(null);
  protected statusClass(s: string) { return ({ ACTIVE: 'bg-sky-100 text-sky-800', DISPENSED: 'bg-emerald-100 text-emerald-800', CANCELLED: 'bg-slate-200 text-slate-700', EXPIRED: 'bg-amber-100 text-amber-800' } as Record<string, string>)[this.status() ?? s] ?? 'bg-slate-100'; }
}
