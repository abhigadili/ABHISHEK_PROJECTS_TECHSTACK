import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { ApiError } from '../../core/models/api-error';
import type { HasUnsavedChanges } from '../../core/guards/unsaved-changes.guard';
import { NotificationService } from '../../core/services/notification.service';
import { PageHeaderComponent } from '../../shared/components';
import { emptyToNull } from '../../shared/utilities/helpers';
import { SignalForm, maxLength, minNumber, required } from '../../shared/utilities/signal-form';
import { PharmacyStore } from '../../state/feature-stores/pharmacy.store';

/** Create / edit medicine with the custom SIGNAL FORM (no Reactive/Template forms involved except ngModel bindings for PrimeNG widgets). */
@Component({
  selector: 'app-pharmacy-medicine-form',
  standalone: true,
  imports: [FormsModule, RouterLink, ButtonModule, InputTextModule, InputNumberModule, PageHeaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mx-auto max-w-2xl"><app-page-header [title]="editing() ? 'Edit medicine' : 'New medicine'" />
      @if (error()) { <p role="alert" class="mb-3 rounded-md bg-red-50 p-3 text-sm text-red-800">{{ error() }}</p> }
      <form class="grid gap-4 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-2 dark:border-slate-700 dark:bg-slate-900" (ngSubmit)="save()" novalidate aria-label="Medicine form">
        @for (f of textFields; track f.key) {
          <label class="flex flex-col gap-1 text-sm">{{ f.label }}<input pInputText [ngModel]="form.fields[f.key].value()" (ngModelChange)="form.fields[f.key].set($event)" (blur)="form.fields[f.key].blur()" [ngModelOptions]="{ standalone: true }" [attr.aria-label]="f.label" />
            @if (form.fields[f.key].visibleError(); as e) { <span class="text-xs text-red-600">{{ e }}</span> }</label> }
        @for (f of numFields; track f.key) {
          <label class="flex flex-col gap-1 text-sm">{{ f.label }}<p-inputnumber [ngModel]="form.fields[f.key].value()" (ngModelChange)="form.fields[f.key].set($event ?? 0)" (onBlur)="form.fields[f.key].blur()" [ngModelOptions]="{ standalone: true }" [min]="0" [minFractionDigits]="f.key === 'unitPrice' ? 2 : 0" [ariaLabel]="f.label" />
            @if (form.fields[f.key].visibleError(); as e) { <span class="text-xs text-red-600">{{ e }}</span> }</label> }
        <div class="flex justify-end gap-2 sm:col-span-2"><a routerLink="/pharmacy"><p-button label="Cancel" severity="secondary" [text]="true" type="button" /></a><p-button type="submit" [label]="editing() ? 'Save changes' : 'Create medicine'" [loading]="form.submitting()" /></div>
      </form></div>`,
})
export class PharmacyMedicineFormComponent implements HasUnsavedChanges {
  readonly id = input<string | undefined>();
  private readonly store = inject(PharmacyStore);
  private readonly router = inject(Router);
  private readonly notify = inject(NotificationService);
  protected readonly editing = computed(() => !!this.id());
  protected readonly error = signal<string | null>(null);
  protected readonly textFields = [{ key: 'sku' as const, label: 'SKU' }, { key: 'name' as const, label: 'Name' }, { key: 'genericName' as const, label: 'Generic name' }];
  protected readonly numFields = [{ key: 'unitPrice' as const, label: 'Unit price' }, { key: 'stockQuantity' as const, label: 'Stock quantity' }, { key: 'reorderLevel' as const, label: 'Reorder level' }];
  protected readonly form = new SignalForm(
    { sku: '', name: '', genericName: '', unitPrice: 0, stockQuantity: 0, reorderLevel: 10 },
    { sku: [required('SKU is required'), maxLength(40)], name: [required('Name is required'), maxLength(150)], genericName: [maxLength(150)], unitPrice: [minNumber(0.01, 'Price must be above 0')], stockQuantity: [minNumber(0)], reorderLevel: [minNumber(0)] },
  );
  private done = false;
  constructor() {
    // prefill when editing: the store already holds the entities
    queueMicrotask(() => { const m = this.store.entityMap()[Number(this.id())]; if (m) { const f = this.form.fields; f.sku.set(m.sku); f.name.set(m.name); f.genericName.set(m.genericName ?? ''); f.unitPrice.set(m.unitPrice); f.stockQuantity.set(m.stockQuantity); f.reorderLevel.set(m.reorderLevel); } });
  }
  protected save() {
    this.error.set(null);
    this.form.submit((v) => {
      const body = { sku: v.sku.trim(), name: v.name.trim(), genericName: emptyToNull(v.genericName), unitPrice: v.unitPrice, stockQuantity: Math.floor(v.stockQuantity), reorderLevel: Math.floor(v.reorderLevel) };
      this.form.submitting.set(true);
      (this.editing() ? this.store.update(Number(this.id()), body) : this.store.create(body)).subscribe({
        next: (m) => { this.store.saved(m); this.done = true; this.notify.success('Medicine saved'); void this.router.navigate(['/pharmacy/medicines', m.id]); },
        error: (e: unknown) => { this.form.submitting.set(false); this.error.set(ApiError.from(e).message); },
      });
    });
  }
  hasUnsavedChanges() { return !this.done && this.form.dirty(); }
}
