import { ChangeDetectionStrategy, Component, DestroyRef, Input, OnChanges, SimpleChanges, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Actions, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { take } from 'rxjs';
import type { Hospital } from '../../core/models';
import { HospitalsActions } from '../../state/actions/hospitals.actions';
import { PageHeaderComponent } from '../../shared/components';
import { PhoneValidatorDirective } from '../../shared/validators/template-validators';

/**
 * "Basic Hospital Information Form" – TEMPLATE-DRIVEN (Bootstrap). ngForm, ngModel, required / maxlength / pattern, a custom validator
 * directive, dirty/pristine/touched/valid/invalid/pending state, reset and per-field messages. Submits through the NgRx effect (concatMap).
 */
@Component({
  selector: 'app-hospital-form',
  standalone: true,
  imports: [FormsModule, PhoneValidatorDirective, PageHeaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header [title]="hospital ? 'Edit ' + hospital.name : 'Register hospital'" subtitle="Hospital Service" />
    <div class="bs-scope">
      <form #f="ngForm" (ngSubmit)="submit(f.valid)" novalidate class="card card-body" style="max-width: 760px" aria-label="Hospital form">
        @if (error()) { <div class="alert alert-danger" role="alert">{{ error() }}</div> }
        <div class="row g-3">
          <div class="col-md-8"><label class="form-label" for="h-name">Hospital name</label><input id="h-name" class="form-control" [class.is-invalid]="name.invalid && (name.touched || f.submitted)" name="name" [(ngModel)]="model.name" #name="ngModel" required maxlength="150" /><div class="invalid-feedback">Name is required (max 150 characters)</div></div>
          <div class="col-md-4"><label class="form-label" for="h-code">Code</label><input id="h-code" class="form-control" [class.is-invalid]="code.invalid && (code.touched || f.submitted)" name="code" [(ngModel)]="model.code" #code="ngModel" required maxlength="30" pattern="[A-Za-z0-9_-]+" /><div class="invalid-feedback">Letters, digits, - and _ only</div></div>
          <div class="col-12"><label class="form-label" for="h-addr">Address</label><input id="h-addr" class="form-control" name="address" [(ngModel)]="model.address" maxlength="255" /></div>
          <div class="col-md-4"><label class="form-label" for="h-city">City</label><input id="h-city" class="form-control" name="city" [(ngModel)]="model.city" maxlength="80" /></div>
          <div class="col-md-4"><label class="form-label" for="h-phone">Phone</label><input id="h-phone" class="form-control" [class.is-invalid]="phone.invalid && phone.touched" name="phone" [(ngModel)]="model.phone" #phone="ngModel" appPhone /><div class="invalid-feedback">{{ phone.errors?.['phone'] }}</div></div>
          <div class="col-md-4"><label class="form-label" for="h-mail">E-mail</label><input id="h-mail" type="email" class="form-control" [class.is-invalid]="mail.invalid && mail.touched" name="email" [(ngModel)]="model.email" #mail="ngModel" email maxlength="120" /><div class="invalid-feedback">Enter a valid e-mail address</div></div>
        </div>
        <div class="d-flex justify-content-between align-items-center mt-4">
          <small class="text-muted">{{ f.dirty ? 'dirty' : 'pristine' }} · {{ f.touched ? 'touched' : 'untouched' }} · {{ f.valid ? 'valid' : f.invalid ? 'invalid' : 'pending' }}</small>
          <div class="d-flex gap-2"><button type="button" class="btn btn-outline-secondary" (click)="f.resetForm(initial())" [disabled]="f.pristine">Reset</button><button type="submit" class="btn btn-primary" [disabled]="busy()">{{ busy() ? 'Saving…' : hospital ? 'Save changes' : 'Register hospital' }}</button></div>
        </div>
      </form>
    </div>`,
})
export class HospitalFormComponent implements OnChanges {
  @Input() hospital: Hospital | null = null;
  private readonly store = inject(Store);
  private readonly actions$ = inject(Actions);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected model = { name: '', code: '', address: '', city: '', phone: '', email: '' };
  protected initial() { const h = this.hospital; return { name: h?.name ?? '', code: h?.code ?? '', address: h?.address ?? '', city: h?.city ?? '', phone: h?.phone ?? '', email: h?.email ?? '' }; }
  ngOnChanges(c: SimpleChanges) { if (c['hospital']) this.model = this.initial(); }

  protected submit(valid: boolean | null) {
    if (!valid) return;
    const m = this.model;
    const body = { name: m.name.trim(), code: m.code.trim(), ...(m.address.trim() && { address: m.address.trim() }), ...(m.city.trim() && { city: m.city.trim() }), ...(m.phone.trim() && { phone: m.phone.trim() }), ...(m.email.trim() && { email: m.email.trim() }) };
    this.busy.set(true); this.error.set(null);
    this.actions$.pipe(ofType(HospitalsActions.saveHospitalSuccess, HospitalsActions.failure), take(1), takeUntilDestroyed(this.destroyRef)).subscribe((a) => {
      this.busy.set(false);
      if (a.type === HospitalsActions.failure.type) this.error.set((a as { error: string }).error);
      else void this.router.navigate(['/hospitals', (a as ReturnType<typeof HospitalsActions.saveHospitalSuccess>).hospital.id]);
    });
    this.store.dispatch(HospitalsActions.saveHospital({ id: this.hospital?.id, hospital: body }));
  }
}
