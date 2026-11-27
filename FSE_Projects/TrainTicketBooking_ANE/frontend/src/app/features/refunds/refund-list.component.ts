import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { PageEvent } from '@angular/material/paginator';
import { BehaviorSubject, catchError, combineLatest, of, switchMap, tap } from 'rxjs';
import type { PageMeta, Refund } from '../../core/models/models';
import { RefundService } from '../../core/services/account.services';
import { toApiError } from '../../core/interceptors/error.interceptor';
import { Column, DataTableComponent } from '../../shared/components/data-table.component';
import { PageHeaderComponent } from '../../shared/components/ui.components';

@Component({
  selector: 'app-refund-list', imports: [RouterLink, MatButtonModule, MatIconModule, DataTableComponent, PageHeaderComponent], changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header title="Refunds" subtitle="Amounts returned after cancellations" />
    <app-data-table [columns]="columns" [rows]="rows()" [meta]="meta()" [loading]="loading()" [error]="error()" emptyTitle="No refunds yet" emptyMessage="Refunds appear after you cancel a paid ticket." (pageChange)="page$.next($event)" (retry)="retry$.next(retry$.value + 1)">
      <ng-template #actions let-row><a mat-icon-button [routerLink]="['/app/bookings', row.bookingId]" aria-label="Open booking"><mat-icon>open_in_new</mat-icon></a></ng-template>
    </app-data-table>`,
})
export class RefundListComponent {
  private readonly api = inject(RefundService);
  readonly page$ = new BehaviorSubject<PageEvent>({ pageIndex: 0, pageSize: 10, length: 0 }); readonly retry$ = new BehaviorSubject(0);
  readonly rows = signal<Refund[]>([]); readonly meta = signal<PageMeta | null>(null); readonly loading = signal(true); readonly error = signal<string | null>(null);
  readonly columns: Column<Refund>[] = [
    { key: 'reference', label: 'Refund ref' }, { key: 'createdAt', label: 'Date', kind: 'datetime' },
    { key: 'pnr', label: 'PNR', value: (r) => r.booking?.pnr?.pnr ?? '—' }, { key: 'train', label: 'Train', value: (r) => (r.booking ? `${r.booking.train.number} ${r.booking.train.name}` : '') },
    { key: 'pay', label: 'Original payment', value: (r) => r.payment?.reference ?? '' }, { key: 'charge', label: 'Charge', kind: 'money', align: 'end', value: (r) => r.cancellation?.chargeAmount },
    { key: 'amount', label: 'Refund', kind: 'money', align: 'end' }, { key: 'status', label: 'Status', kind: 'chip' },
  ];
  constructor() {
    combineLatest([this.page$, this.retry$]).pipe(tap(() => { this.loading.set(true); this.error.set(null); }),
      switchMap(([page]) => this.api.list({ page: page.pageIndex, size: page.pageSize }).pipe(catchError((e) => { this.error.set(toApiError(e).message); return of(null); }))), takeUntilDestroyed(),
    ).subscribe((r) => { this.loading.set(false); if (r) { this.rows.set(r.items); this.meta.set(r.meta); } });
  }
}
