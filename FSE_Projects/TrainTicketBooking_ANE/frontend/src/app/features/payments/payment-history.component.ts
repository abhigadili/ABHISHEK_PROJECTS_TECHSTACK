import { ChangeDetectionStrategy, Component, TemplateRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { PageEvent } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { BehaviorSubject, catchError, combineLatest, debounceTime, distinctUntilChanged, of, startWith, switchMap, tap } from 'rxjs';
import type { PageMeta, Payment } from '../../core/models/models';
import { PaymentService } from '../../core/services/account.services';
import { toApiError } from '../../core/interceptors/error.interceptor';
import { Column, DataTableComponent } from '../../shared/components/data-table.component';
import { PageHeaderComponent } from '../../shared/components/ui.components';
import { MatTooltipModule } from '@angular/material/tooltip';

/** Payment / transaction history (passengers see their own; staff with payment:read-all see everyone's - decided by the backend). */
@Component({
  selector: 'app-payment-history', imports: [ReactiveFormsModule, RouterLink, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule, MatSelectModule, MatTooltipModule, DataTableComponent, PageHeaderComponent], changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header title="Payments" subtitle="Transactions and receipts" />
    <div class="card row" style="margin-bottom:16px">
      <mat-form-field style="flex:2;min-width:200px"><mat-label>Search reference or PNR</mat-label><mat-icon matPrefix>search</mat-icon><input matInput [formControl]="q" /></mat-form-field>
      <mat-form-field style="flex:1;min-width:160px"><mat-label>Status</mat-label><mat-select [formControl]="status"><mat-option value="">All</mat-option>@for (s of statuses; track s) { <mat-option [value]="s">{{ s.replace('_', ' ') }}</mat-option> }</mat-select></mat-form-field>
    </div>
    <app-data-table [columns]="columns" [rows]="rows()" [meta]="meta()" [loading]="loading()" [error]="error()" (pageChange)="page$.next($event)" (retry)="retry$.next(retry$.value + 1)">
      <ng-template #actions let-row>
        @if (['SUCCEEDED', 'REFUNDED', 'PARTIALLY_REFUNDED'].includes(row.status)) { <a mat-icon-button [routerLink]="['/app/payments', row.id, 'receipt']" matTooltip="Receipt" aria-label="Open receipt"><mat-icon>receipt_long</mat-icon></a> }
        <a mat-icon-button [routerLink]="['/app/bookings', row.bookingId]" matTooltip="Booking" aria-label="Open booking"><mat-icon>open_in_new</mat-icon></a>
      </ng-template>
    </app-data-table>`,
})
export class PaymentHistoryComponent {
  private readonly api = inject(PaymentService);
  readonly statuses = ['INITIATED', 'SUCCEEDED', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED'];
  readonly q = new FormControl('', { nonNullable: true }); readonly status = new FormControl('', { nonNullable: true });
  readonly page$ = new BehaviorSubject<PageEvent>({ pageIndex: 0, pageSize: 10, length: 0 }); readonly retry$ = new BehaviorSubject(0);
  readonly rows = signal<Payment[]>([]); readonly meta = signal<PageMeta | null>(null); readonly loading = signal(true); readonly error = signal<string | null>(null);
  readonly columns: Column<Payment>[] = [
    { key: 'reference', label: 'Reference' }, { key: 'createdAt', label: 'Date', kind: 'datetime' },
    { key: 'pnr', label: 'PNR', value: (p) => p.booking?.pnr?.pnr ?? '—' }, { key: 'train', label: 'Train', value: (p) => (p.booking ? `${p.booking.train.number} ${p.booking.train.name}` : '') },
    { key: 'method', label: 'Method', value: (p) => p.method.replace('_', ' ') + (p.cardLast4 ? ` ••${p.cardLast4}` : '') }, { key: 'amount', label: 'Amount', kind: 'money', align: 'end' }, { key: 'status', label: 'Status', kind: 'chip' },
  ];
  constructor() {
    combineLatest([this.q.valueChanges.pipe(startWith(''), debounceTime(300), distinctUntilChanged()), this.status.valueChanges.pipe(startWith('')), this.page$, this.retry$]).pipe(
      tap(() => { this.loading.set(true); this.error.set(null); }),
      switchMap(([q, status, page]) => this.api.list({ q: q.trim(), status, page: page.pageIndex, size: page.pageSize }).pipe(catchError((e) => { this.error.set(toApiError(e).message); return of(null); }))),
      takeUntilDestroyed(),
    ).subscribe((r) => { this.loading.set(false); if (r) { this.rows.set(r.items); this.meta.set(r.meta); } });
  }
}
