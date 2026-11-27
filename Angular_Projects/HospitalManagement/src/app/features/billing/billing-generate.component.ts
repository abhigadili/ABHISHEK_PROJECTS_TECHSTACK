import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormArray, FormControl, FormGroup, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Actions, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { map, startWith, take } from 'rxjs';
import type { HasUnsavedChanges } from '../../core/guards/unsaved-changes.guard';
import type { BillType, Patient } from '../../core/models';
import { PatientPickerComponent, PageHeaderComponent, QuantityStepperComponent } from '../../shared/components';
import { emptyToNull } from '../../shared/utilities/helpers';
import { BillingActions } from '../../state/actions/billing.actions';
import { selectBillingSaving } from '../../state/selectors/billing.selectors';

type Line = FormGroup<{ description: FormControl<string>; quantity: FormControl<number>; unitPrice: FormControl<number> }>;

/** Generate invoice (staff). Typed FormArray of line items with a live total; dispatches `Generate`; navigates when `Generate Success` arrives (Actions stream). */
@Component({
  selector: 'app-billing-generate',
  standalone: true,
  imports: [CurrencyPipe, ReactiveFormsModule, RouterLink, PageHeaderComponent, PatientPickerComponent, QuantityStepperComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bs-scope mx-auto" style="max-width: 820px">
      <app-page-header title="Generate invoice" subtitle="Manual invoice for a patient" />
      <form [formGroup]="form" (ngSubmit)="submit()" novalidate aria-label="Invoice form">
        <div class="card mb-3"><div class="card-body">
          <label class="form-label">Patient</label><app-patient-picker [(patient)]="patient" />@if (submitted() && !patient()) { <div class="text-danger small mt-1">Select a patient</div> }
          <div class="row g-3 mt-1"><div class="col-sm-4"><label class="form-label" for="bt">Type</label><select id="bt" class="form-select" formControlName="billType">@for (t of types; track t) { <option [value]="t">{{ t }}</option> }</select></div>
            <div class="col-sm-8"><label class="form-label" for="note">Note</label><input id="note" class="form-control" formControlName="note" /></div></div></div></div>
        <div class="card mb-3"><div class="card-body"><h2 class="h6">Line items</h2>
          <div formArrayName="items">@for (g of items.controls; track g; let i = $index) {
            <div [formGroupName]="i" class="row g-2 mb-2 align-items-start">
              <div class="col-sm-6"><input class="form-control" formControlName="description" placeholder="Description" [attr.aria-label]="'Description ' + (i + 1)" [class.is-invalid]="g.controls.description.touched && g.controls.description.invalid" /><div class="invalid-feedback">Required</div></div>
              <div class="col-6 col-sm-3"><app-quantity-stepper formControlName="quantity" [label]="'Quantity ' + (i + 1)" /></div>
              <div class="col-4 col-sm-2"><input class="form-control" type="number" step="0.01" formControlName="unitPrice" [attr.aria-label]="'Unit price ' + (i + 1)" [class.is-invalid]="g.controls.unitPrice.invalid" /></div>
              <div class="col-3 col-sm-1"><button class="btn btn-outline-danger" type="button" [disabled]="items.length === 1" (click)="remove(i)" [attr.aria-label]="'Remove item ' + (i + 1)">✕</button></div></div> }</div>
          <button class="btn btn-outline-primary btn-sm" type="button" (click)="add()">+ Add line</button>
          <div class="text-end fs-5 mt-2">Total <b>{{ total() | currency }}</b></div></div></div>
        <div class="d-flex justify-content-end gap-2"><a class="btn btn-outline-secondary" routerLink="/billing">Cancel</a><button class="btn btn-primary" type="submit" [disabled]="saving()">@if (saving()) { <span class="spinner-border spinner-border-sm me-1"></span> } Generate invoice</button></div>
      </form>
    </div>`,
})
export class BillingGenerateComponent implements HasUnsavedChanges {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly store = inject(Store);
  private readonly router = inject(Router);
  private readonly actions$ = inject(Actions);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly types: BillType[] = ['OTHER', 'APPOINTMENT', 'LAB', 'MEDICINE'];
  protected readonly patient = signal<Patient | null>(null);
  protected readonly submitted = signal(false);
  protected readonly saving = this.store.selectSignal(selectBillingSaving);
  protected readonly items = this.fb.array<Line>([this.line()], Validators.minLength(1));
  protected readonly form = this.fb.group({ billType: this.fb.control<BillType>('OTHER'), note: ['', Validators.maxLength(500)], items: this.items });
  /** Live total: valueChanges → map → toSignal (startWith gives the initial value). */
  protected readonly total = toSignal(this.items.valueChanges.pipe(startWith(this.items.getRawValue()), map(() => this.items.getRawValue().reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0), 0))), { initialValue: 0 });
  private done = false;
  private line(): Line { return this.fb.group({ description: ['', [Validators.required, Validators.maxLength(200)]], quantity: [1, [Validators.required, Validators.min(1), Validators.max(1000)]], unitPrice: [0, [Validators.required, Validators.min(0.01), Validators.max(1_000_000)]] }); }
  protected add() { this.items.push(this.line()); }
  protected remove(i: number) { if (this.items.length > 1) this.items.removeAt(i); }
  protected submit() {
    this.submitted.set(true); this.form.markAllAsTouched();
    if (!this.patient() || this.form.invalid) return;
    const v = this.form.getRawValue();
    this.actions$.pipe(ofType(BillingActions.generateSuccess), take(1), takeUntilDestroyed(this.destroyRef)).subscribe(({ bill }) => { this.done = true; void this.router.navigate(['/billing/invoices', bill.id]); });
    this.store.dispatch(BillingActions.generate({ bill: { patientId: this.patient()!.id, billType: v.billType, note: emptyToNull(v.note), items: v.items.map((l) => ({ description: l.description.trim(), quantity: Number(l.quantity), unitPrice: Number(l.unitPrice) })) } }));
  }
  hasUnsavedChanges() { return !this.done && (this.form.dirty || !!this.patient()); }
}
