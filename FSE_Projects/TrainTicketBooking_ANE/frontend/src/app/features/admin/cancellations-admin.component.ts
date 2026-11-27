import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import type { CancellationRow } from '../../core/models/models';
import { BookingService } from '../../core/services/account.services';
import { Column, DataTableComponent } from '../../shared/components/data-table.component';
import { PageHeaderComponent } from '../../shared/components/ui.components';
import { listState } from '../../shared/list-state';

@Component({
  selector: 'app-cancellations-admin', imports: [RouterLink, MatButtonModule, MatIconModule, DataTableComponent, PageHeaderComponent], changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header title="Cancellations" subtitle="Cancelled tickets, charges and refunds" />
    <app-data-table [columns]="columns" [rows]="l.rows()" [meta]="l.meta()" [loading]="l.loading()" [error]="l.error()" (pageChange)="l.page$.next($event)" (retry)="l.reload()">
      <ng-template #actions let-c><a mat-icon-button [routerLink]="['/app/bookings', c.bookingId]" aria-label="Open booking"><mat-icon>open_in_new</mat-icon></a></ng-template>
    </app-data-table>`,
})
export class CancellationsAdminComponent {
  private readonly api = inject(BookingService);
  readonly l = listState<CancellationRow>((q) => this.api.cancellations(q));
  readonly columns: Column<CancellationRow>[] = [
    { key: 'createdAt', label: 'When', kind: 'datetime' }, { key: 'pnr', label: 'PNR', value: (c) => c.booking.pnr?.pnr ?? '—' }, { key: 'train', label: 'Train', value: (c) => `${c.booking.train.number} ${c.booking.train.name}` },
    { key: 'user', label: 'Passenger', value: (c) => c.booking.user?.name ?? '' }, { key: 'pax', label: 'Pax', value: (c) => c.passengerIds.length }, { key: 'hoursBefore', label: 'Hours before', align: 'end' },
    { key: 'grossFare', label: 'Fare', kind: 'money', align: 'end' }, { key: 'chargeAmount', label: 'Charge', kind: 'money', align: 'end' }, { key: 'refundAmount', label: 'Refund', kind: 'money', align: 'end' },
  ];
}
