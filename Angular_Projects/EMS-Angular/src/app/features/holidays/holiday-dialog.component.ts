import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { AppError } from '../../core/models/api.models';
import { Holiday } from '../../core/models/leave.models';
import { HolidayService } from '../../core/services/holiday.service';
import { DialogFrameComponent } from '../../shared/components/dialogs';
import { errorMessage } from '../../shared/validators/validators';

@Component({
  selector: 'app-holiday-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, MatDialogModule, MatButtonModule, MatCheckboxModule, MatFormFieldModule, MatInputModule, DialogFrameComponent],
  template: `
    <app-dialog-frame [title]="data ? 'Edit holiday' : 'New holiday'">
      <form [formGroup]="form" id="holiday-form" (ngSubmit)="save()" novalidate>
        @if (error(); as e) { <p class="err" role="alert">{{ e.message }}</p> }
        <mat-form-field appearance="outline" class="full"><mat-label>Date</mat-label><input matInput type="date" formControlName="holidayDate" data-testid="holiday-date" /><mat-error>{{ err('holidayDate', 'Date') }}</mat-error></mat-form-field>
        <mat-form-field appearance="outline" class="full"><mat-label>Name</mat-label><input matInput formControlName="name" data-testid="holiday-name" /><mat-error>{{ err('name', 'Name') }}</mat-error></mat-form-field>
        <mat-form-field appearance="outline" class="full"><mat-label>Location (blank = all)</mat-label><input matInput formControlName="location" /></mat-form-field>
        <mat-checkbox formControlName="isOptional">Optional holiday</mat-checkbox>
      </form>
      <button dialogActions mat-button type="button" mat-dialog-close>Cancel</button>
      <button dialogActions mat-flat-button color="primary" type="submit" form="holiday-form" [disabled]="busy()" data-testid="holiday-save">Save</button>
    </app-dialog-frame>
  `,
  styles: `.full { width: 100%; min-width: min(360px, 80vw); } .err { color: #c5221f; }`,
})
export class HolidayDialogComponent {
  protected readonly data = inject<Holiday | null>(MAT_DIALOG_DATA);
  private readonly ref = inject<MatDialogRef<HolidayDialogComponent, boolean>>(MatDialogRef);
  private readonly svc = inject(HolidayService);
  private readonly fb = inject(NonNullableFormBuilder);
  protected readonly busy = signal(false);
  protected readonly error = signal<AppError | null>(null);

  protected readonly form = this.fb.group({
    holidayDate: [this.data?.holidayDate?.slice(0, 10) ?? '', Validators.required],
    name: [this.data?.name ?? '', [Validators.required, Validators.maxLength(120)]],
    location: [this.data && this.data.location !== 'ALL' ? this.data.location : '', [Validators.maxLength(100)]],
    isOptional: [this.data?.isOptional ?? false],
  });
  protected readonly err = (n: 'holidayDate' | 'name', l: string) => errorMessage(this.form.controls[n], l);

  protected save(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.busy()) return;
    const v = this.form.getRawValue();
    const body = { holidayDate: v.holidayDate, name: v.name.trim(), isOptional: v.isOptional, ...(v.location.trim() ? { location: v.location.trim() } : {}) };
    this.busy.set(true);
    (this.data ? this.svc.update(this.data.id, body) : this.svc.create(body)).subscribe({
      next: () => this.ref.close(true),
      error: (e: AppError) => { this.error.set(e); this.busy.set(false); },
    });
  }
}
