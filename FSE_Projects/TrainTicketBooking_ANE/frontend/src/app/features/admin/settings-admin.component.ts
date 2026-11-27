import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { FormArray, FormControl, FormGroup, NonNullableFormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { finalize } from 'rxjs';
import type { HasUnsavedChanges } from '../../core/guards/guards';
import { toApiError } from '../../core/interceptors/error.interceptor';
import { BookingService } from '../../core/services/account.services';
import { ToastService } from '../../core/services/toast.service';
import { FieldErrorComponent, PageHeaderComponent } from '../../shared/components/ui.components';

type RuleGroup = FormGroup<{ minHoursBefore: FormControl<number>; chargePercent: FormControl<number>; label: FormControl<string> }>;
/** Cancellation rules are data (the backend applies the highest threshold not exceeding the hours left). */
@Component({
  selector: 'app-settings-admin', imports: [ReactiveFormsModule, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule, PageHeaderComponent, FieldErrorComponent], changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header title="Cancellation rules" subtitle="Charge percentage by hours before departure" />
    <form class="card" [formGroup]="form" (ngSubmit)="save()" novalidate>
      <div formArrayName="rules">
        @for (r of rules.controls; track r; let i = $index) {
          <div class="row" [formGroupName]="i">
            <mat-form-field style="width:150px"><mat-label>Hours before ≥</mat-label><input matInput type="number" min="0" max="8760" formControlName="minHoursBefore" /><mat-error><app-field-error [control]="r.controls.minHoursBefore" label="Hours" /></mat-error></mat-form-field>
            <mat-form-field style="width:130px"><mat-label>Charge %</mat-label><input matInput type="number" min="0" max="100" formControlName="chargePercent" /><mat-error><app-field-error [control]="r.controls.chargePercent" label="Charge" /></mat-error></mat-form-field>
            <mat-form-field style="flex:1;min-width:180px"><mat-label>Label</mat-label><input matInput formControlName="label" maxlength="80" /><mat-error><app-field-error [control]="r.controls.label" label="Label" /></mat-error></mat-form-field>
            <button mat-icon-button type="button" (click)="rules.removeAt(i); form.markAsDirty()" [disabled]="rules.length <= 1" [attr.aria-label]="'Remove rule ' + (i + 1)"><mat-icon>delete</mat-icon></button>
          </div>
        }
      </div>
      @if (form.hasError('dupes')) { <p class="err">Each hour threshold may appear once.</p> }
      @if (form.hasError('zero')) { <p class="err">Include a rule with 0 hours (last-minute cancellations).</p> }
      @if (error()) { <p class="err" role="alert">{{ error() }}</p> }
      <div class="row"><button mat-stroked-button type="button" (click)="add()" [disabled]="rules.length >= 10"><mat-icon>add</mat-icon>Add rule</button><button mat-flat-button type="submit" [disabled]="busy()">Save rules</button></div>
    </form>`,
})
export class SettingsAdminComponent implements OnInit, HasUnsavedChanges {
  private readonly api = inject(BookingService); private readonly fb = inject(NonNullableFormBuilder); private readonly toast = inject(ToastService);
  readonly busy = signal(false); readonly error = signal('');
  readonly form = this.fb.group({ rules: this.fb.array<RuleGroup>([]) }, { validators: [(c): ValidationErrors | null => { const v = (c.get('rules') as FormArray<RuleGroup>).getRawValue(); const hrs = v.map((r) => r.minHoursBefore); return new Set(hrs).size !== hrs.length ? { dupes: true } : !hrs.includes(0) ? { zero: true } : null; }] });
  get rules() { return this.form.controls.rules; }
  ngOnInit() { this.api.rules().subscribe((rs) => { this.rules.clear(); rs.slice().sort((a, b) => b.minHoursBefore - a.minHoursBefore).forEach((r) => this.add(r)); this.form.markAsPristine(); }); }
  hasUnsavedChanges() { return this.form.dirty; }
  add(r?: { minHoursBefore: number; chargePercent: number | string; label: string }) {
    this.rules.push(this.fb.group({ minHoursBefore: this.fb.control(r?.minHoursBefore ?? 0, [Validators.required, Validators.min(0), Validators.max(8760)]), chargePercent: this.fb.control(Number(r?.chargePercent ?? 0), [Validators.required, Validators.min(0), Validators.max(100)]), label: this.fb.control(r?.label ?? '', [Validators.required, Validators.maxLength(80)]) }));
    if (!r) this.form.markAsDirty();
  }
  save() {
    this.form.markAllAsTouched(); if (this.form.invalid || this.busy()) return; this.busy.set(true); this.error.set('');
    this.api.setRules(this.rules.getRawValue().map((r) => ({ ...r, minHoursBefore: Number(r.minHoursBefore), chargePercent: Number(r.chargePercent) }))).pipe(finalize(() => this.busy.set(false))).subscribe({ next: () => { this.form.markAsPristine(); this.toast.success('Rules saved.'); }, error: (e) => this.error.set(toApiError(e).message) });
  }
}
