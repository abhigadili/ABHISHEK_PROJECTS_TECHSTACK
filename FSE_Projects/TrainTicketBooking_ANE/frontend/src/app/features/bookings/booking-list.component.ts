import { AsyncPipe, CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, input, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EmptyStateComponent, ErrorStateComponent, PageHeaderComponent, StatusChipComponent } from '../../shared/components/ui.components';
import { PnrPipe } from '../../shared/pipes/pipes';
import { BookingsListStore } from './bookings-list.store';

@Component({
  selector: 'app-booking-list',
  imports: [AsyncPipe, DatePipe, CurrencyPipe, FormsModule, RouterLink, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule, MatPaginatorModule, MatSelectModule, PageHeaderComponent, StatusChipComponent, EmptyStateComponent, ErrorStateComponent, PnrPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header [title]="heading()" subtitle="Tickets, PNRs and cancellations"><a mat-flat-button routerLink="/"><mat-icon>add</mat-icon>New booking</a></app-page-header>
    @if (store.vm$ | async; as vm) {
      <form class="card filters" aria-label="Booking filters">
        <mat-form-field><mat-label>Status</mat-label><mat-select name="status" [ngModel]="vm.status" (ngModelChange)="store.setFilter({ status: $event })">
          <mat-option value="">All</mat-option>@for (s of statuses; track s) { <mat-option [value]="s">{{ s.replace('_', ' ') }}</mat-option> }</mat-select></mat-form-field>
        <mat-form-field><mat-label>When</mat-label><mat-select name="scope" [ngModel]="vm.scope" (ngModelChange)="store.setFilter({ scope: $event })"><mat-option value="">All</mat-option><mat-option value="upcoming">Upcoming</mat-option><mat-option value="past">Past</mat-option></mat-select></mat-form-field>
        <mat-form-field><mat-label>Search PNR / train / passenger</mat-label><input matInput name="q" [ngModel]="vm.q" (ngModelChange)="q$.next($event)" /></mat-form-field>
      </form>
      @if (vm.error) { <app-error-state [message]="vm.error" (retry)="store.load()" /> }
      @else {
        @for (b of vm.items; track b.id) {
          <article class="card bk" tabindex="0" (click)="open(b.id)" (keyup.enter)="open(b.id)">
            <div class="row spread"><div><strong>{{ b.train.number }} · {{ b.train.name }}</strong><br /><span class="muted">{{ b.fromStation.code }} → {{ b.toStation.code }} · {{ b.departureAt | date: 'EEE, dd MMM yyyy HH:mm' }}</span></div><app-status-chip [status]="b.status" /></div>
            <div class="row spread meta"><span>PNR: <strong>{{ b.pnr?.pnr | pnr }}</strong></span><span>{{ b.passengers.length }} passenger(s) · {{ b.coachType?.code }}</span><strong>{{ b.totalAmount | currency: 'INR' }}</strong></div>
          </article>
        } @empty { @if (!vm.loading) { <app-empty-state icon="confirmation_number" title="No bookings found" message="Your bookings will appear here." /> } }
        @if (vm.meta; as m) { <mat-paginator [length]="m.total" [pageSize]="m.size" [pageIndex]="m.page" [pageSizeOptions]="[5, 10, 25]" (page)="store.setFilter({ page: $event.pageIndex, size: $event.pageSize })" aria-label="Booking pages" /> }
      }
    }`,
  styles: [`.filters{display:grid;grid-template-columns:1fr 1fr 2fr;gap:12px;margin-bottom:16px}@media (max-width:700px){.filters{grid-template-columns:1fr}}.bk{margin-bottom:12px;cursor:pointer}.bk:hover{border-color:var(--c-primary)}.meta{margin-top:10px;padding-top:10px;border-top:1px dashed var(--c-border)}`],
})
export class BookingListComponent implements OnInit {
  /** Route data (`data: { heading }`) binds here; the admin area reuses this component. */
  readonly heading = input('My bookings');
  readonly store = inject(BookingsListStore);
  private readonly router = inject(Router);
  readonly statuses = ['PENDING_PAYMENT', 'CONFIRMED', 'PARTIALLY_CANCELLED', 'CANCELLED', 'EXPIRED', 'FAILED'];
  readonly q$ = new Subject<string>();
  constructor() { this.q$.pipe(debounceTime(350), distinctUntilChanged(), takeUntilDestroyed()).subscribe((q) => this.store.setFilter({ q: q.trim() })); }
  ngOnInit() { this.store.load(); }
  open(id: number) { void this.router.navigate(['/app/bookings', id]); }
}
