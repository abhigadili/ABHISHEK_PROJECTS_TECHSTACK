import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import type { Patient } from '../../core/models';
import { CurrentIdentityService } from '../../core/services/current-identity.service';
import { NoticeComponent, PageHeaderComponent, PatientPickerComponent } from '../../shared/components';

/** Medical records entry point: a PATIENT goes straight to their own record, staff pick a patient (shared model() control). */
@Component({
  selector: 'app-records-home',
  standalone: true,
  imports: [RouterLink, PageHeaderComponent, PatientPickerComponent, NoticeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header title="Medical records" subtitle="Open a patient's clinical file"><a actions routerLink="documents" class="rounded-md border border-slate-300 px-3 py-2 text-sm no-underline dark:border-slate-600">Medical documents</a></app-page-header>
    @if (auth.role() === 'PATIENT') { @if (own() === null) { <app-notice tone="warning" heading="No patient profile">Create your patient profile to see a medical record. <a routerLink="/auth/register" class="font-semibold underline">Register</a></app-notice> } @else { <p class="text-sm text-slate-500">Opening your record…</p> } }
    @else { <div class="max-w-xl rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900"><p class="mb-3 text-sm text-slate-500">The Medical Records Service keeps a timeline per patient (diagnoses, visits, lab reports, prescriptions, allergies, notes). Search for a patient to open it.</p><app-patient-picker [(patient)]="picked" /></div> }`,
})
export class RecordsHomeComponent {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly own = toSignal(inject(CurrentIdentityService).patient$);
  protected readonly picked = signal<Patient | null>(null);
  constructor() {
    effect(() => { const p = this.picked(); if (p) void this.router.navigate(['/records/patients', p.id]); });
    effect(() => { const o = this.own(); if (this.auth.role() === 'PATIENT' && o) void this.router.navigate(['/records/patients', o.id], { replaceUrl: true }); });
  }
}
