import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { catchError, filter, map, of, switchMap } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { CurrentIdentityService } from '../../core/services/current-identity.service';
import { toLoadState } from '../../shared/utilities/load-state';
import { DataStateComponent } from '../../shared/components';
import { PatientNamePipe } from '../../shared/pipes/pipes';
import { ageFromDob, avatarUri } from '../../shared/utilities/helpers';
import type { Patient } from '../../core/models';

/**
 * "My profile" (Tailwind CSS profile card). PATIENT → own patient profile (or a prompt to complete it); DOCTOR → redirected to the doctor
 * profile; every other role sees its account details.
 */
@Component({
  selector: 'app-patient-profile',
  standalone: true,
  imports: [RouterLink, DataStateComponent, PatientNamePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (auth.role() === 'PATIENT') {
      <app-data-state [state]="state()">
        <ng-template #loaded let-p>
          @if (p) {
            <section class="mx-auto max-w-3xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <div class="h-24 bg-gradient-to-r from-brand-700 to-sky-400"></div>
              <div class="-mt-10 flex flex-wrap items-end gap-4 px-6"><img [src]="avatar(p)" alt="" width="80" height="80" class="rounded-full border-4 border-white dark:border-slate-900" loading="lazy" />
                <div class="pb-1"><h1 class="text-2xl font-bold">{{ p | patientName }}</h1><p class="text-sm text-slate-500">Patient #{{ p.id }} · {{ age(p) ?? '—' }} years · {{ p.bloodGroup ?? 'blood group n/a' }}</p></div>
                <a [routerLink]="['/patients', p.id, 'edit']" class="ml-auto rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium dark:border-slate-600">Edit profile</a></div>
              <dl class="grid gap-4 p-6 sm:grid-cols-2">@for (f of facts(p); track f[0]) { <div><dt class="text-xs font-semibold uppercase tracking-wide text-slate-500">{{ f[0] }}</dt><dd class="text-sm">{{ f[1] || '—' }}</dd></div> }</dl>
              <div class="flex flex-wrap gap-2 border-t border-slate-200 p-4 dark:border-slate-700">
                @for (l of links; track l[0]) { <a [routerLink]="['/patients', p.id, l[1]]" class="rounded-full bg-slate-100 px-3 py-1 text-sm hover:bg-brand-50 dark:bg-slate-800">{{ l[0] }}</a> }</div>
            </section>
          } @else { <div class="mx-auto max-w-md rounded-xl border border-amber-300 bg-amber-50 p-6 text-center"><p class="font-semibold text-amber-900">No patient profile yet</p><p class="mb-3 text-sm text-amber-800">Complete your registration to book appointments.</p><a routerLink="/auth/register" class="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white">Complete profile</a></div> }
        </ng-template>
      </app-data-state>
    } @else {
      <section class="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <h1 class="text-xl font-bold">{{ auth.user()?.username }}</h1><p class="text-sm text-slate-500">{{ auth.user()?.email }}</p>
        <p class="mt-3 inline-block rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">{{ auth.role() }}</p>
        @if (auth.role() === 'DOCTOR') { <p class="mt-4 text-sm text-amber-700">No doctor profile is linked to this login yet – an administrator must create one with this account's user id ({{ auth.user()?.id }}).</p> }
      </section>
    }`,
})
export class PatientProfileComponent {
  protected readonly auth = inject(AuthService);
  private readonly identity = inject(CurrentIdentityService);
  private readonly router = inject(Router);
  protected readonly state = toSignal(this.identity.patient$.pipe(map((p) => p), switchMap((p) => toLoadState(of(p)))), { initialValue: { status: 'loading' as const } });
  protected readonly links = [['Appointments', 'appointments'], ['Prescriptions', 'prescriptions'], ['Lab reports', 'lab-reports'], ['Billing', 'billing']] as const;
  protected readonly age = (p: Patient) => ageFromDob(p.dateOfBirth);
  protected readonly avatar = (p: Patient) => avatarUri(`${p.firstName} ${p.lastName}`, 160);
  protected facts(p: Patient): [string, string | null][] { return [['E-mail', p.email], ['Phone', p.phone], ['Date of birth', p.dateOfBirth], ['Gender', p.gender], ['Address', p.address], ['Emergency contact', p.emergencyContactName ? `${p.emergencyContactName} (${p.emergencyContactPhone ?? '—'})` : null], ['Known allergies', p.knownAllergies], ['Identity number', p.identityNumber]]; }
  constructor() {
    // DOCTOR: jump to the doctor profile once the profile is resolved
    this.identity.doctor$.pipe(filter((d) => !!d && this.auth.role() === 'DOCTOR'), catchError(() => of(null)), takeUntilDestroyed()).subscribe((d) => void this.router.navigate(['/doctors', d!.id], { replaceUrl: true }));
  }
}
