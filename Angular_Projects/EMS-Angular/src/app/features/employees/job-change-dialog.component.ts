import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, NonNullableFormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { AppError } from '../../core/models/api.models';
import { CHANGE_TYPES, ChangeType, Employee } from '../../core/models/employee.models';
import { EmployeeService } from '../../core/services/employee.service';
import { ReferenceDataService } from '../../core/services/reference-data.service';
import { DialogFrameComponent } from '../../shared/components/dialogs';
import { EmployeeSelectComponent } from '../../shared/components/employee-select.component';
import { todayIso } from '../../shared/utils/dates';
import { errorMessage } from '../../shared/validators/validators';

/** Form-level rule: a job change must actually change at least one thing. */
function atLeastOneChange(group: AbstractControl): ValidationErrors | null {
  const v = group.value as { designationId: number | null; departmentId: number | null; managerId: number | null; jobTitle: string };
  return v.designationId || v.departmentId || v.managerId || v.jobTitle?.trim() ? null : { noChange: true };
}

/**
 * Promotion / transfer / manager change — built with NonNullableFormBuilder. Submitting updates the employee through
 * PUT /employees/:id with `changeType` + `effectiveDate`, and the backend records the job-history entry itself.
 */
@Component({
  selector: 'app-job-change-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatSelectModule, DialogFrameComponent, EmployeeSelectComponent],
  template: `
    <app-dialog-frame [title]="'Job change · ' + employee.fullName">
      <form [formGroup]="form" id="job-change-form" (ngSubmit)="submit()" novalidate>
        @if (error(); as e) {
          <p class="err" role="alert">{{ e.message }}</p>
        }
        <mat-form-field appearance="outline" class="full">
          <mat-label>Type of change</mat-label>
          <mat-select formControlName="changeType" data-testid="change-type">
            @for (t of types; track t) {
              <mat-option [value]="t">{{ t.replaceAll('_', ' ') }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        <mat-form-field appearance="outline" class="full">
          <mat-label>New designation</mat-label>
          <mat-select formControlName="designationId">
            <mat-option [value]="null">No change (current: {{ employee.designation?.name ?? 'none' }})</mat-option>
            @for (d of designations(); track d.id) {
              <mat-option [value]="d.id">{{ d.name }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        <mat-form-field appearance="outline" class="full">
          <mat-label>New department</mat-label>
          <mat-select formControlName="departmentId">
            <mat-option [value]="null">No change (current: {{ employee.department?.name ?? 'none' }})</mat-option>
            @for (d of departments(); track d.id) {
              <mat-option [value]="d.id">{{ d.name }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        <app-employee-select label="New manager" formControlName="managerId" />
        <mat-form-field appearance="outline" class="full">
          <mat-label>New job title</mat-label>
          <input matInput formControlName="jobTitle" maxlength="120" />
        </mat-form-field>
        <mat-form-field appearance="outline" class="full">
          <mat-label>Effective date</mat-label>
          <input matInput type="date" formControlName="effectiveDate" />
          <mat-error>{{ err('effectiveDate', 'Effective date') }}</mat-error>
        </mat-form-field>
        <mat-form-field appearance="outline" class="full">
          <mat-label>Notes</mat-label>
          <textarea matInput rows="2" formControlName="notes" maxlength="500"></textarea>
        </mat-form-field>
        @if (form.hasError('noChange') && form.touched) {
          <p class="err" role="alert">Choose at least one thing to change (designation, department, manager or job title).</p>
        }
      </form>
      <button dialogActions mat-button type="button" mat-dialog-close>Cancel</button>
      <button dialogActions mat-flat-button color="primary" type="submit" form="job-change-form" [disabled]="busy()" data-testid="job-change-save">Save change</button>
    </app-dialog-frame>
  `,
  styles: `.full { width: 100%; min-width: min(420px, 80vw); } .err { color: #c5221f; margin: 0 0 8px; }`,
})
export class JobChangeDialogComponent {
  protected readonly employee = inject<Employee>(MAT_DIALOG_DATA);
  private readonly ref = inject<MatDialogRef<JobChangeDialogComponent, boolean>>(MatDialogRef);
  private readonly employees = inject(EmployeeService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly reference = inject(ReferenceDataService);

  protected readonly types = CHANGE_TYPES.filter((t) => t !== 'STATUS_CHANGE');
  protected readonly designations = toSignal(this.reference.designations(), { initialValue: [] });
  protected readonly departments = toSignal(this.reference.departments(), { initialValue: [] });
  protected readonly busy = signal(false);
  protected readonly error = signal<AppError | null>(null);

  protected readonly form = this.fb.group(
    {
      changeType: this.fb.control<ChangeType>('PROMOTION', Validators.required),
      designationId: this.fb.control<number | null>(null),
      departmentId: this.fb.control<number | null>(null),
      managerId: this.fb.control<number | null>(null),
      jobTitle: [''],
      effectiveDate: [todayIso(), Validators.required],
      notes: [''],
    },
    { validators: atLeastOneChange },
  );

  protected readonly err = (n: 'effectiveDate', l: string) => errorMessage(this.form.controls[n], l);

  protected submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.busy()) return;
    const v = this.form.getRawValue();
    this.busy.set(true);
    this.error.set(null);
    this.employees
      .update(this.employee.id, {
        changeType: v.changeType,
        effectiveDate: v.effectiveDate,
        notes: v.notes.trim() || null,
        ...(v.designationId ? { designationId: v.designationId } : {}),
        ...(v.departmentId ? { departmentId: v.departmentId } : {}),
        ...(v.managerId ? { managerId: v.managerId } : {}),
        ...(v.jobTitle.trim() ? { jobTitle: v.jobTitle.trim() } : {}),
      })
      .subscribe({
        next: () => this.ref.close(true),
        error: (e: AppError) => {
          this.error.set(e);
          this.busy.set(false);
        },
      });
  }
}
