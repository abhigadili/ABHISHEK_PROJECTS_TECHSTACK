import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { AbstractControl, NonNullableFormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { AppError } from '../../core/models/api.models';
import { ATTENDANCE_STATUSES, AttendanceRecord, AttendanceStatus, WORK_MODES, WorkMode } from '../../core/models/attendance.models';
import { AttendanceService } from '../../core/services/attendance.service';
import { DialogFrameComponent } from '../../shared/components/dialogs';
import { EmployeeSelectComponent } from '../../shared/components/employee-select.component';
import { todayIso } from '../../shared/utils/dates';
import { errorMessage } from '../../shared/validators/validators';

export interface AttendanceEditData {
  record?: AttendanceRecord;
}

const toLocalInput = (iso: string | null | undefined): string => {
  if (!iso) return '';
  const d = new Date(iso);
  const p = (n: number) => `${n}`.padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

function outAfterIn(g: AbstractControl): ValidationErrors | null {
  const i = g.get('checkInAt')?.value as string;
  const o = g.get('checkOutAt')?.value as string;
  return i && o && new Date(o) <= new Date(i) ? { outBeforeIn: true } : null;
}

/** One dialog, two modes: correct an existing record (PUT) or add a manual record for an employee/day (POST). */
@Component({
  selector: 'app-attendance-edit-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatSelectModule, DialogFrameComponent, EmployeeSelectComponent],
  template: `
    <app-dialog-frame [title]="record ? 'Correct attendance · ' + record.workDate : 'Add attendance record'">
      <form [formGroup]="form" id="attendance-form" (ngSubmit)="save()" novalidate>
        @if (error(); as e) {
          <p class="err" role="alert">{{ e.message }}</p>
        }
        @if (!record) {
          <app-employee-select label="Employee" formControlName="employeeId" />
          <mat-form-field appearance="outline" class="full">
            <mat-label>Work date</mat-label>
            <input matInput type="date" formControlName="workDate" />
            <mat-error>{{ err('workDate', 'Work date') }}</mat-error>
          </mat-form-field>
        }
        <mat-form-field appearance="outline" class="full">
          <mat-label>Check-in</mat-label>
          <input matInput type="datetime-local" formControlName="checkInAt" data-testid="att-in" />
        </mat-form-field>
        <mat-form-field appearance="outline" class="full">
          <mat-label>Check-out</mat-label>
          <input matInput type="datetime-local" formControlName="checkOutAt" data-testid="att-out" />
        </mat-form-field>
        @if (form.hasError('outBeforeIn')) {
          <p class="err" role="alert">Check-out must be after check-in.</p>
        }
        <mat-form-field appearance="outline" class="full">
          <mat-label>Status</mat-label>
          <mat-select formControlName="status">
            @for (s of statuses; track s) {
              <mat-option [value]="s">{{ s.replace('_', ' ') }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        <mat-form-field appearance="outline" class="full">
          <mat-label>Work mode</mat-label>
          <mat-select formControlName="workMode">
            @for (m of modes; track m) {
              <mat-option [value]="m">{{ m }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        <mat-form-field appearance="outline" class="full">
          <mat-label>Reason for this change (audited)</mat-label>
          <textarea matInput rows="2" formControlName="reason" data-testid="att-reason"></textarea>
          <mat-error>{{ err('reason', 'Reason') }}</mat-error>
        </mat-form-field>
      </form>
      <button dialogActions mat-button type="button" mat-dialog-close>Cancel</button>
      <button dialogActions mat-flat-button color="primary" type="submit" form="attendance-form" [disabled]="busy()" data-testid="att-save">Save</button>
    </app-dialog-frame>
  `,
  styles: `.full { width: 100%; min-width: min(380px, 80vw); } .err { color: #c5221f; margin: 0 0 8px; }`,
})
export class AttendanceEditDialogComponent {
  protected readonly record = inject<AttendanceEditData>(MAT_DIALOG_DATA).record;
  private readonly ref = inject<MatDialogRef<AttendanceEditDialogComponent, boolean>>(MatDialogRef);
  private readonly svc = inject(AttendanceService);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly statuses = ATTENDANCE_STATUSES;
  protected readonly modes = WORK_MODES;
  protected readonly busy = signal(false);
  protected readonly error = signal<AppError | null>(null);

  protected readonly form = this.fb.group(
    {
      employeeId: this.fb.control<number | null>(null, this.record ? [] : [Validators.required]),
      workDate: [todayIso(), this.record ? [] : [Validators.required]],
      checkInAt: [toLocalInput(this.record?.checkInAt)],
      checkOutAt: [toLocalInput(this.record?.checkOutAt)],
      status: this.fb.control<AttendanceStatus>(this.record?.status ?? 'PRESENT'),
      workMode: this.fb.control<WorkMode>(this.record?.workMode ?? 'OFFICE'),
      reason: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(500)]],
    },
    { validators: outAfterIn },
  );
  protected readonly err = (n: 'workDate' | 'reason', l: string) => errorMessage(this.form.controls[n], l);

  protected save(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.busy()) return;
    const v = this.form.getRawValue();
    const iso = (s: string) => (s ? new Date(s).toISOString() : null);
    const common = { checkInAt: iso(v.checkInAt), checkOutAt: iso(v.checkOutAt), status: v.status, workMode: v.workMode, reason: v.reason.trim() };
    this.busy.set(true);
    (this.record ? this.svc.correct(this.record.id, common) : this.svc.createManual({ ...common, employeeId: v.employeeId!, workDate: v.workDate })).subscribe({
      next: () => this.ref.close(true),
      error: (e: AppError) => {
        this.error.set(e);
        this.busy.set(false);
      },
    });
  }
}
