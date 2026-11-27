import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputNumberModule } from 'primeng/inputnumber';
import { TagModule } from 'primeng/tag';
import { AuthService } from '../../core/auth/auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { NoticeComponent, PageHeaderComponent } from '../../shared/components';
import { SignalForm, minNumber } from '../../shared/utilities/signal-form';
import { PharmacyStore, stockLevel } from '../../state/feature-stores/pharmacy.store';

/** Medicine details + availability + restock. The restock form uses the custom SIGNAL FORM; the store applies the change optimistically. */
@Component({
  selector: 'app-pharmacy-medicine-details',
  standalone: true,
  imports: [CurrencyPipe, FormsModule, RouterLink, ButtonModule, InputNumberModule, TagModule, PageHeaderComponent, NoticeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mx-auto max-w-2xl">
      <app-page-header title="Medicine" [subtitle]="medicine()?.sku ?? '#' + id()"><span actions class="flex gap-2">@if (auth.can('pharmacy:manage') && medicine()) { <a [routerLink]="['edit']"><p-button label="Edit" severity="secondary" [outlined]="true" /></a> }<a routerLink="/pharmacy"><p-button label="Back" severity="secondary" [text]="true" /></a></span></app-page-header>
      @if (medicine(); as m) {
        <section class="space-y-3 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
          <div class="flex items-start justify-between"><div><h2 class="text-xl font-semibold">{{ m.name }}</h2><p class="text-sm text-slate-500">{{ m.genericName ?? 'no generic name' }}</p></div><p-tag [value]="availability()" [severity]="m.stockQuantity <= 0 ? 'danger' : m.stockQuantity <= m.reorderLevel ? 'warn' : 'success'" /></div>
          <dl class="grid gap-3 text-sm sm:grid-cols-4"><div><dt class="text-xs text-slate-500">Unit price</dt><dd class="font-semibold">{{ m.unitPrice | currency }}</dd></div><div><dt class="text-xs text-slate-500">In stock</dt><dd class="font-semibold">{{ m.stockQuantity }}</dd></div><div><dt class="text-xs text-slate-500">Reorder level</dt><dd>{{ m.reorderLevel }}</dd></div><div><dt class="text-xs text-slate-500">Stock value</dt><dd>{{ m.unitPrice * m.stockQuantity | currency }}</dd></div></dl>
        </section>
        @if (auth.can('pharmacy:manage')) {
          <form class="mt-4 space-y-2 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900" (ngSubmit)="restock()" novalidate aria-label="Restock form">
            <h3 class="font-semibold">Restock</h3>
            <p-inputnumber [ngModel]="form.fields.quantity.value()" (ngModelChange)="form.fields.quantity.set($event ?? 0)" (onBlur)="form.fields.quantity.blur()" [ngModelOptions]="{ standalone: true }" [min]="0" [showButtons]="true" inputId="qty" ariaLabel="Quantity to add" />
            @if (form.fields.quantity.visibleError(); as e) { <p class="text-xs text-red-600" role="alert">{{ e }}</p> }
            <div><p-button type="submit" label="Add stock" [loading]="form.submitting()" /></div>
          </form>
        }
      } @else if (store.loading()) { <p class="text-sm text-slate-500">Loading…</p> }
      @else { <app-notice tone="warning" heading="Medicine not found">It may be inactive or the id is wrong.</app-notice> }
    </div>`,
})
export class PharmacyMedicineDetailsComponent {
  readonly id = input.required<string>();
  protected readonly store = inject(PharmacyStore);
  protected readonly auth = inject(AuthService);
  private readonly notify = inject(NotificationService);
  protected readonly medicine = computed(() => this.store.entityMap()[Number(this.id())] ?? null);
  protected readonly availability = computed(() => { const m = this.medicine(); return m ? ({ OK: 'In stock', LOW: 'Low stock', OUT: 'Out of stock' } as const)[stockLevel(m)] : ''; });
  protected readonly form = new SignalForm({ quantity: 10 }, { quantity: [minNumber(1, 'Enter a quantity of at least 1')] });
  protected restock() {
    this.form.submit((v) => { const m = this.medicine(); if (!m) return; this.store.restock({ id: m.id, quantity: Math.floor(v.quantity) }); this.notify.success(`Added ${v.quantity} to ${m.name}`); this.form.reset(); });
  }
  protected readonly _unused = signal(0);
}
