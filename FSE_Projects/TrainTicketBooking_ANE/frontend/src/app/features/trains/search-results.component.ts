import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { Store } from '@ngrx/store';
import { AsyncPipe } from '@angular/common';
import { combineLatest, distinctUntilChanged, filter, forkJoin, map, switchMap } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import type { SearchResult, Station } from '../../core/models/models';
import { LookupService, StationService } from '../../core/services/catalog.services';
import { SearchStore } from '../../store/search.store';
import { BookingFlowActions, toJourney } from '../../store/booking-flow/booking-flow.store';
import { DurationPipe, StationPipe } from '../../shared/pipes/pipes';
import { EmptyStateComponent, ErrorStateComponent, PageHeaderComponent } from '../../shared/components/ui.components';
import { SearchFormComponent } from './search-form.component';
import { fromIsoDate } from '../../shared/utils';

@Component({
  selector: 'app-search-results',
  imports: [FormsModule, RouterLink, AsyncPipe, DatePipe, CurrencyPipe, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule, MatSelectModule, DurationPipe, EmptyStateComponent, ErrorStateComponent, PageHeaderComponent, SearchFormComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="container">
      @if (criteria(); as c) {
        <app-page-header [title]="c.from.name + ' → ' + c.to.name" [subtitle]="(c.date | date: 'EEE, dd MMM yyyy') + ' · ' + c.passengers + ' passenger(s)'">
          <button mat-stroked-button (click)="showForm = !showForm"><mat-icon>edit</mat-icon>Modify search</button>
        </app-page-header>
        @if (showForm) { <div class="card mb"><app-search-form [initial]="initial()" /></div> }
        <!-- TEMPLATE-DRIVEN filters (ngModel) feeding the SignalStore; every change re-queries the backend (previous request is cancelled) -->
        <form class="card filters" #ff="ngForm" aria-label="Filters and sorting">
          <mat-form-field><mat-label>Sort by</mat-label>
            <mat-select name="sort" [ngModel]="store.filters().sort" (ngModelChange)="store.setFilters({ sort: $event })">
              <mat-option value="departure">Departure</mat-option><mat-option value="duration">Duration</mat-option><mat-option value="fare">Fare</mat-option><mat-option value="name">Train name</mat-option></mat-select></mat-form-field>
          <mat-form-field><mat-label>Train type</mat-label>
            <mat-select name="type" [ngModel]="store.filters().type" (ngModelChange)="store.setFilters({ type: $event })">
              <mat-option value="">All</mat-option>@for (t of types; track t) { <mat-option [value]="t">{{ t }}</mat-option> }</mat-select></mat-form-field>
          <mat-form-field><mat-label>Class</mat-label>
            <mat-select name="cls" [ngModel]="store.filters().coachTypeId" (ngModelChange)="store.setFilters({ coachTypeId: $event })">
              <mat-option [value]="null">Any</mat-option>@for (k of (lookups.coachTypes$ | async); track k.id) { <mat-option [value]="k.id">{{ k.name }}</mat-option> }</mat-select></mat-form-field>
          <mat-form-field><mat-label>Departs after</mat-label>
            <input matInput type="time" name="after" [ngModel]="store.filters().departAfter" (ngModelChange)="store.setFilters({ departAfter: $event })" /></mat-form-field>
        </form>
      }
      @if (store.error(); as e) { <app-error-state [message]="e" (retry)="store.refresh()" /> }
      @else if (store.loading()) { <div class="card muted" role="status" aria-live="polite">Searching trains…</div> }
      @else if (store.searched()) {
        <p class="muted" role="status" aria-live="polite">{{ store.count() }} train(s) found</p>
        @for (r of store.results(); track r.train.id + r.runDate) {
          <article class="card res">
            <div class="top">
              <div><h3><a [routerLink]="['/trains', r.train.id]">{{ r.train.number }} · {{ r.train.name }}</a></h3><small class="muted">{{ r.train.type }} · {{ r.distanceKm }} km</small></div>
              <div class="times"><div><b>{{ r.from.departure | date: 'HH:mm' }}</b><small>{{ r.from.station.code }} · {{ r.from.departure | date: 'dd MMM' }}</small></div>
                <div class="dur"><mat-icon>east</mat-icon><small>{{ r.durationMinutes | duration }}</small></div>
                <div><b>{{ r.to.arrival | date: 'HH:mm' }}</b><small>{{ r.to.station.code }} · {{ r.to.arrival | date: 'dd MMM' }}</small></div></div>
            </div>
            <div class="classes">
              @for (k of r.classes; track k.coachTypeId) {
                <div class="cls" [class.sold]="k.available === 0">
                  <div><strong>{{ k.name }}</strong><br /><span class="avail" [class.low]="k.available > 0 && k.available <= 10">{{ k.available > 0 ? k.available + ' seats available' : 'Sold out' }}</span></div>
                  <div class="price">{{ k.fare | currency: 'INR' : 'symbol' : '1.0-0' }}<small class="muted"> /person</small></div>
                  <button mat-flat-button [disabled]="k.available < (criteria()?.passengers ?? 1)" (click)="book(r, k)">{{ k.available === 0 ? 'Sold out' : k.available < (criteria()?.passengers ?? 1) ? 'Not enough seats' : 'Book' }}</button>
                </div>
              }
            </div>
          </article>
        } @empty {
          <app-empty-state icon="train" title="No trains found" message="No train runs on this date between these stations, or all seats are taken. Try another date or fewer filters." />
        }
      }
    </div>`,
  styles: [`.mb{margin-bottom:16px}.filters{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px}@media (max-width:800px){.filters{grid-template-columns:1fr 1fr}}
    .res{margin-bottom:14px}.top{display:flex;flex-wrap:wrap;justify-content:space-between;gap:12px}.res h3{margin:0}.res h3 a{text-decoration:none}
    .times{display:flex;align-items:center;gap:16px}.times div{display:flex;flex-direction:column;text-align:center}.times b{font-size:1.4rem}.dur{align-items:center;color:var(--c-muted)}
    .classes{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:10px;margin-top:14px}.cls{display:flex;align-items:center;justify-content:space-between;gap:10px;border:1px solid var(--c-border);border-radius:10px;padding:10px 12px}
    .cls.sold{opacity:.6}.avail{color:#1e6b34;font-size:.85rem}.avail.low{color:#b45309}.sold .avail{color:#b3261e}.price{font-weight:700;text-align:right}`],
})
export class SearchResultsComponent {
  readonly store = inject(SearchStore);
  readonly lookups = inject(LookupService);
  private readonly stations = inject(StationService);
  private readonly router = inject(Router);
  private readonly ngrx = inject(Store);
  readonly auth = inject(AuthService);
  readonly types = ['EXPRESS', 'SUPERFAST', 'SUBURBAN', 'PASSENGER', 'PREMIUM'];
  showForm = false;
  // query params arrive as signal inputs (withComponentInputBinding)
  readonly from = input<string>(); readonly to = input<string>(); readonly date = input<string>(); readonly pax = input<string>(); readonly cls = input<string>();
  readonly criteria = computed(() => this.store.criteria());
  readonly initial = computed(() => { const c = this.store.criteria(); return c ? { from: c.from, to: c.to, date: c.date, passengers: c.passengers, coachTypeId: this.store.filters().coachTypeId ?? undefined } : null; });

  constructor() {
    // combineLatest of the bound params -> resolve both stations in parallel (forkJoin) -> run the (cancellable) search
    toObservable(computed(() => ({ from: this.from(), to: this.to(), date: this.date(), pax: this.pax(), cls: this.cls() }))).pipe(
      filter((p) => !!p.from && !!p.to && !!p.date),
      distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b)),
      switchMap((p) => forkJoin([this.stations.get(Number(p.from)), this.stations.get(Number(p.to))]).pipe(map(([f, t]) => ({ f, t, p })))),
      takeUntilDestroyed(),
    ).subscribe(({ f, t, p }) => {
      if (p.cls) this.store.setFilters({ coachTypeId: Number(p.cls) });
      this.store.search({ from: f as Station, to: t as Station, date: p.date!, passengers: Math.max(1, Number(p.pax) || 1) });
    });
  }
  book(r: SearchResult, k: SearchResult['classes'][number]) {
    const pax = this.criteria()?.passengers ?? 1; const date = this.criteria()!.date;
    this.ngrx.dispatch(BookingFlowActions.selectJourney({ journey: toJourney(r, k, date), passengerCount: pax }));
    void this.router.navigate(['/app/book'], { queryParams: { trainId: r.train.id, date, from: r.from.station.id, to: r.to.station.id, cls: k.coachTypeId, pax } });
  }
}
