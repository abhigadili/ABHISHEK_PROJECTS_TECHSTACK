import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Store } from '@ngrx/store';
import { PatientApiService } from '../../core/api/patient-api.service';
import { ApiError, errorMessage } from '../../core/models/api-error';
import type { PatientInput } from '../../core/models';
import { NotificationService } from '../../core/services/notification.service';
import { PatientsActions } from '../../state/actions/patients.actions';
import { PhoneValidatorDirective } from '../../shared/validators/template-validators';
import { PatientContextService } from './patient-context.service';

/**
 * TEMPLATE-DRIVEN FORM (FormsModule): "Simple Patient Contact Form".
 *  ngForm / ngModel / ngModelGroup, template validation (required, minlength, maxlength, pattern), a custom validator directive
 *  (appPhone), form state flags (dirty, pristine, touched, untouched, valid, invalid, pending), reset, error messages.
 * Submit merges the edited contact fields into the loaded patient (PUT /patients/{id} needs the whole resource).
 */
@Component({
  selector: 'app-patient-contact',
  standalone: true,
  imports: [FormsModule, PhoneValidatorDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form #f="ngForm" (ngSubmit)="submit(f.value)" novalidate class="max-w-2xl space-y-5 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900" aria-label="Contact form">
      @if (error()) { <p role="alert" class="rounded-md bg-red-50 p-3 text-sm text-red-800">{{ error() }}</p> }
      <fieldset ngModelGroup="contact" #contact="ngModelGroup" class="grid gap-4 sm:grid-cols-2">
        <legend class="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Contact information</legend>
        <div><label for="c-email" class="mb-1 block text-sm font-medium">E-mail</label>
          <input id="c-email" name="email" type="email" [ngModel]="model().email" required email maxlength="120" #email="ngModel" class="h-10 w-full rounded-md border border-slate-300 bg-transparent px-3 dark:border-slate-600" />
          @if (email.invalid && (email.touched || f.submitted)) { <p class="mt-1 text-xs text-red-600">@if (email.errors?.['required']) { E-mail is required } @else { Enter a valid e-mail address }</p> }</div>
        <div><label for="c-phone" class="mb-1 block text-sm font-medium">Mobile phone</label>
          <input id="c-phone" name="phone" [ngModel]="model().phone" required appPhone minlength="7" maxlength="16" #phone="ngModel" class="h-10 w-full rounded-md border border-slate-300 bg-transparent px-3 dark:border-slate-600" />
          @if (phone.invalid && (phone.touched || f.submitted)) { <p class="mt-1 text-xs text-red-600">{{ phone.errors?.['required'] ? 'Phone is required' : (phone.errors?.['phone'] ?? 'Invalid phone number') }}</p> }</div>
        <div class="sm:col-span-2"><label for="c-addr" class="mb-1 block text-sm font-medium">Address</label>
          <input id="c-addr" name="address" [ngModel]="model().address" maxlength="255" pattern="[^<>]*" #address="ngModel" class="h-10 w-full rounded-md border border-slate-300 bg-transparent px-3 dark:border-slate-600" />
          @if (address.errors?.['pattern']) { <p class="mt-1 text-xs text-red-600">Angle brackets are not allowed</p> }</div>
      </fieldset>
      <fieldset ngModelGroup="emergency" class="grid gap-4 sm:grid-cols-2">
        <legend class="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Emergency contact</legend>
        <div><label for="e-name" class="mb-1 block text-sm font-medium">Name</label><input id="e-name" name="name" [ngModel]="model().emergencyContactName" maxlength="100" class="h-10 w-full rounded-md border border-slate-300 bg-transparent px-3 dark:border-slate-600" /></div>
        <div><label for="e-phone" class="mb-1 block text-sm font-medium">Phone</label><input id="e-phone" name="phone" [ngModel]="model().emergencyContactPhone" appPhone #ephone="ngModel" class="h-10 w-full rounded-md border border-slate-300 bg-transparent px-3 dark:border-slate-600" />
          @if (ephone.invalid && ephone.touched) { <p class="mt-1 text-xs text-red-600">{{ ephone.errors?.['phone'] }}</p> }</div>
      </fieldset>
      <div class="flex flex-wrap items-center justify-between gap-3">
        <p class="text-xs text-slate-500" aria-live="polite">
          Form state: <b>{{ f.dirty ? 'dirty' : 'pristine' }}</b> · <b>{{ f.touched ? 'touched' : 'untouched' }}</b> · <b>{{ f.valid ? 'valid' : f.invalid ? 'invalid' : 'pending' }}</b> · group {{ contact.valid ? 'valid' : 'invalid' }}
        </p>
        <div class="flex gap-2">
          <button type="button" class="rounded-md border border-slate-300 px-4 py-2 text-sm disabled:opacity-50 dark:border-slate-600" [disabled]="f.pristine" (click)="f.resetForm(resetValue())">Reset</button>
          <button type="submit" class="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" [disabled]="busy() || f.pristine">{{ busy() ? 'Saving…' : 'Save contact details' }}</button>
        </div>
      </div>
    </form>`,
})
export class PatientContactComponent {
  private readonly ctx = inject(PatientContextService);
  private readonly api = inject(PatientApiService);
  private readonly store = inject(Store);
  private readonly notify = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly model = () => this.ctx.patient() ?? ({ email: '', phone: '', address: '', emergencyContactName: '', emergencyContactPhone: '' } as never as NonNullable<ReturnType<PatientContextService['patient']>>);
  protected resetValue() { const p = this.model(); return { contact: { email: p.email, phone: p.phone, address: p.address ?? '' }, emergency: { name: p.emergencyContactName ?? '', phone: p.emergencyContactPhone ?? '' } }; }

  protected submit(v: { contact: { email: string; phone: string; address: string }; emergency: { name: string; phone: string } }): void {
    const p = this.ctx.patient();
    if (!p || !v.contact) return;
    const body: PatientInput = { firstName: p.firstName, lastName: p.lastName, dateOfBirth: p.dateOfBirth, gender: p.gender, identityNumber: p.identityNumber, bloodGroup: p.bloodGroup, knownAllergies: p.knownAllergies,
      email: v.contact.email.trim(), phone: v.contact.phone.trim(), address: v.contact.address?.trim() || null, emergencyContactName: v.emergency.name?.trim() || null, emergencyContactPhone: v.emergency.phone?.trim() || null };
    this.busy.set(true); this.error.set(null);
    this.api.update(p.id, body).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (saved) => { this.busy.set(false); this.ctx.patient.set(saved); this.store.dispatch(PatientsActions.updateSuccess({ patient: saved })); this.notify.success('Contact details saved'); },
      error: (e: unknown) => { this.busy.set(false); this.error.set(ApiError.from(e).details.length ? errorMessage(e) : ApiError.from(e).message); },
    });
  }
}
