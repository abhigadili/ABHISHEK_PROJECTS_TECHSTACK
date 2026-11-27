import { ChangeDetectionStrategy, Component, DestroyRef, Input, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { Actions, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { take } from 'rxjs';
import type { Patient, PatientInput } from '../../core/models';
import type { HasUnsavedChanges } from '../../core/guards/unsaved-changes.guard';
import { PatientsActions } from '../../state/actions/patients.actions';
import { PageHeaderComponent } from '../../shared/components';
import { PatientFormComponent } from './patient-form.component';

/**
 * Patient profile update (Reactive Form inside <app-patient-form>). Dispatches an NgRx request action and waits for the matching
 * success/failure ACTION (Actions stream) before navigating – the effect (concatMap) does the PUT. CanDeactivate protects unsaved edits.
 */
@Component({
  selector: 'app-patient-edit',
  standalone: true,
  imports: [PatientFormComponent, PageHeaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="max-w-3xl"><app-page-header [title]="'Edit ' + (patient?.firstName ?? '') + ' ' + (patient?.lastName ?? '')" [subtitle]="'Patient #' + (patient?.id ?? '')" />
    <app-patient-form [patient]="patient" [busy]="busy()" [serverErrors]="serverErrors()" submitLabel="Save changes" (save)="save($event)" /></div>`,
})
export class PatientEditComponent implements HasUnsavedChanges {
  /** Resolved patient (route data → input binding). */
  @Input() patient: Patient | null = null;
  private readonly store = inject(Store);
  private readonly actions$ = inject(Actions);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly form = viewChild.required(PatientFormComponent);
  protected readonly busy = signal(false);
  protected readonly serverErrors = signal<Record<string, string> | null>(null);
  private saved = false;

  protected save(input: PatientInput): void {
    if (!this.patient) return;
    this.busy.set(true);
    this.actions$.pipe(ofType(PatientsActions.updateSuccess, PatientsActions.saveFailure), take(1), takeUntilDestroyed(this.destroyRef)).subscribe((a) => {
      this.busy.set(false);
      if (a.type === PatientsActions.updateSuccess.type) { this.saved = true; void this.router.navigate(['/patients', this.patient!.id]); }
    });
    this.store.dispatch(PatientsActions.update({ id: this.patient.id, patient: input }));
  }
  hasUnsavedChanges(): boolean { return !this.saved && this.form().hasUnsavedChanges(); }
}
