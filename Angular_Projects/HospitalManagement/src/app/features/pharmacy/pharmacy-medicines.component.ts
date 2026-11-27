import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectButtonModule } from 'primeng/selectbutton';
import { TagModule } from 'primeng/tag';
import { AuthService } from '../../core/auth/auth.service';
import type { Medicine, StockLevel } from '../../core/models';
import { EmptyStateComponent, ErrorStateComponent, PageHeaderComponent, PagerComponent, SkeletonComponent } from '../../shared/components';
import { MedicineSort, PharmacyStore, stockLevel } from '../../state/feature-stores/pharmacy.store';

/** Medicines catalogue backed by the NgRx SIGNAL STORE (PharmacyStore): the template only reads store signals and calls store methods. */
@Component({
  selector: 'app-pharmacy-medicines',
  standalone: true,
  imports: [CurrencyPipe, FormsModule, RouterLink, ButtonModule, InputTextModule, SelectButtonModule, TagModule, PageHeaderComponent, PagerComponent, EmptyStateComponent, ErrorStateComponent, SkeletonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header title="Pharmacy" subtitle="Medicine inventory">
      <span actions class="flex gap-2"><a routerLink="orders"><p-button label="Orders" severity="secondary" [outlined]="true" /></a>@if (auth.can('pharmacy:manage')) { <a routerLink="medicines/new"><p-button label="New medicine" icon="pi pi-plus" /></a> }</span>
    </app-page-header>
    <div class="mb-4 grid gap-3 sm:grid-cols-3">
      @for (c of cards; track c.key) { <button type="button" class="rounded-xl border border-slate-200 bg-white p-4 text-left dark:border-slate-700 dark:bg-slate-900" (click)="store.setStock(c.key)" [attr.aria-pressed]="store.stock() === c.key"><div class="text-xs text-slate-500">{{ c.label }}</div><div class="text-2xl font-semibold">{{ store.counts()[c.key] }}</div></button> }
    </div>
    @if (store.pinnedMedicines().length) { <div class="mb-3 flex flex-wrap items-center gap-2 text-sm"><span class="text-slate-500">Pinned:</span>@for (m of store.pinnedMedicines(); track m.id) { <a [routerLink]="['medicines', m.id]" class="rounded-full bg-amber-100 px-3 py-1 text-amber-900 no-underline">{{ m.name }}</a> }</div> }
    <div class="mb-3 flex flex-wrap items-center gap-3">
      <input pInputText class="w-full max-w-xs" placeholder="Search name, generic or SKU" aria-label="Search medicines" [ngModel]="store.search()" (ngModelChange)="store.setSearch($event)" />
      <p-selectbutton [options]="stockOptions" [ngModel]="store.stock()" (ngModelChange)="store.setStock($event ?? 'ALL')" optionLabel="label" optionValue="value" ariaLabelledBy="stock" />
    </div>
    @if (store.error()) { <app-error-state [error]="store.error()" (retry)="store.load()" /> }
    @else if (store.loading() && store.entities().length === 0) { <app-skeleton [rows]="6" /> }
    @else if (store.filtered().length === 0) { <app-empty-state title="No medicines match" description="Change the search or stock filter." /> }
    @else {
      <div class="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"><table class="w-full text-sm">
        <thead><tr class="border-b text-left text-xs uppercase text-slate-500"><th class="p-3"><button type="button" (click)="store.setSort('name')">Medicine {{ arrow('name') }}</button></th><th>SKU</th><th class="text-right"><button type="button" (click)="store.setSort('unitPrice')">Price {{ arrow('unitPrice') }}</button></th><th class="text-right"><button type="button" (click)="store.setSort('stockQuantity')">Stock {{ arrow('stockQuantity') }}</button></th><th>Level</th><th></th></tr></thead>
        <tbody>@for (m of store.pageRows(); track m.id) { <tr class="border-b last:border-0"><td class="p-3"><a [routerLink]="['medicines', m.id]" class="font-semibold">{{ m.name }}</a><div class="text-xs text-slate-500">{{ m.genericName ?? '' }}</div></td><td>{{ m.sku }}</td><td class="text-right">{{ m.unitPrice | currency }}</td><td class="text-right">{{ m.stockQuantity }}</td><td><p-tag [value]="level(m)" [severity]="sev(m)" /></td><td><button type="button" [attr.aria-label]="'Pin ' + m.name" [attr.aria-pressed]="store.pinned().includes(m.id)" (click)="store.togglePin(m.id)">{{ store.pinned().includes(m.id) ? '★' : '☆' }}</button></td></tr> }</tbody></table></div>
      <app-pager [page]="store.page()" [size]="store.pageSize()" [total]="store.filtered().length" label="medicines" (pageChange)="store.setPage($event)" />
    }`,
})
export class PharmacyMedicinesComponent {
  protected readonly store = inject(PharmacyStore);
  protected readonly auth = inject(AuthService);
  protected readonly stockOptions: { label: string; value: StockLevel | 'ALL' }[] = [{ label: 'All', value: 'ALL' }, { label: 'In stock', value: 'OK' }, { label: 'Low', value: 'LOW' }, { label: 'Out', value: 'OUT' }];
  protected readonly cards = [{ key: 'OK' as const, label: 'In stock' }, { key: 'LOW' as const, label: 'Low stock' }, { key: 'OUT' as const, label: 'Out of stock' }];
  protected level = stockLevel;
  protected sev(m: Medicine) { return ({ OK: 'success', LOW: 'warn', OUT: 'danger' } as const)[stockLevel(m)]; }
  protected arrow(k: MedicineSort) { return this.store.sort() === k ? (this.store.sortDir() === 'asc' ? '▲' : '▼') : ''; }
}
