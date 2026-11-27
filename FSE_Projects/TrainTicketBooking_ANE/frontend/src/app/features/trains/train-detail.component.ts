import { CurrencyPipe, DatePipe, TitleCasePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatExpansionModule } from '@angular/material/expansion';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { RouterLink } from '@angular/router';
import { catchError, combineLatest, of, switchMap, startWith, map, Observable, shareReplay } from 'rxjs';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { AsyncPipe } from '@angular/common';
import type { Train, TrainAvailability, TrainCoach } from '../../core/models/models';
import { TrainService } from '../../core/services/catalog.services';
import { StationPipe, WeekdaysPipe } from '../../shared/pipes/pipes';
import { PageHeaderComponent, StatusChipComponent, EmptyStateComponent } from '../../shared/components/ui.components';
import { addDays, today, toIsoDate } from '../../shared/utils';

/** Train details: resolver-provided `train` input, route timeline (deferred), schedules, coaches and per-date availability. */
@Component({
  selector: 'app-train-detail',
  imports: [DatePipe, CurrencyPipe, AsyncPipe, RouterLink, ReactiveFormsModule, MatButtonModule, MatIconModule, MatTabsModule, MatExpansionModule, MatDatepickerModule, MatFormFieldModule, MatInputModule, StationPipe, WeekdaysPipe, PageHeaderComponent, StatusChipComponent, EmptyStateComponent, TitleCasePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (train(); as t) {
    <div class="container">
      <app-page-header [title]="t.number + ' · ' + t.name" [subtitle]="(t.type | titlecase) + ' train'">
        <app-status-chip [status]="t.status" />
        <a mat-flat-button routerLink="/"><mat-icon>search</mat-icon>Search this route</a>
      </app-page-header>
      <mat-tab-group animationDuration="0ms">
        <mat-tab label="Route & timings">
          <div class="card tab">
            @defer (on viewport; prefetch on idle) {
              <ol class="tl" aria-label="Route stops">
                @for (s of t.route?.stops ?? []; track s.seq) {
                  <li><span class="dot"></span><div class="stop"><strong><a [routerLink]="['/stations', s.stationId]">{{ s.station | station }}</a></strong>
                    <small class="muted">{{ s.arrivalTime ?? '—' }} arr · {{ s.departureTime ?? '—' }} dep · {{ s.distanceKm }} km @if (s.dayOffset) { · day +{{ s.dayOffset }} }</small></div></li>
                } @empty { <app-empty-state icon="alt_route" title="No route configured" /> }
              </ol>
            } @placeholder { <div class="muted" style="min-height:120px">Route timeline</div> } @loading (minimum 300ms) { <div class="muted">Loading route…</div> }
          </div>
        </mat-tab>
        <mat-tab label="Schedule">
          <div class="card tab">
            @for (s of t.schedules; track s.id) {
              <div class="row spread sched"><div><strong>{{ s.operatingDays | weekdays }}</strong><br /><small class="muted">Valid {{ s.validFrom | date: 'dd MMM yyyy' }} → {{ s.validTo ? (s.validTo | date: 'dd MMM yyyy') : 'open-ended' }}</small></div><app-status-chip [status]="s.active ? 'ACTIVE' : 'INACTIVE'" /></div>
            } @empty { <app-empty-state icon="event_busy" title="No schedule" message="This train has no operating schedule yet." /> }
            @if (t.overrides?.length) { <h3>Date exceptions</h3>@for (o of t.overrides; track o.id) { <p>{{ o.date | date: 'dd MMM yyyy' }} — {{ o.cancelled ? 'Cancelled' : 'Running' }} {{ o.reason ? '(' + o.reason + ')' : '' }}</p> } }
          </div>
        </mat-tab>
        <mat-tab label="Coaches & fares">
          <div class="card tab">
            @if (coaches$ | async; as cs) {
              <div class="coach-grid">@for (c of cs; track c.id) { <div class="coach"><strong>{{ c.number }}</strong><small>{{ c.coachType.name }}</small><small class="muted">{{ c._count?.seats }} seats</small></div> } @empty { <app-empty-state icon="train" title="No coaches" /> }</div>
            }
          </div>
        </mat-tab>
        <mat-tab label="Availability">
          <div class="card tab">
            <mat-form-field><mat-label>Date</mat-label><input matInput [matDatepicker]="dp" [min]="min" [formControl]="date" /><mat-datepicker-toggle matIconSuffix [for]="dp" /><mat-datepicker #dp /></mat-form-field>
            @if (availability(); as a) {
              @if (a.error) { <p class="err" role="alert">{{ a.error }}</p> }
              @else { @if (a.data; as d) {
                <p>{{ d.from | station }} → {{ d.to | station }} · departs {{ d.departure | date: 'dd MMM, HH:mm' }}, arrives {{ d.arrival | date: 'dd MMM, HH:mm' }}</p>
                <div class="grid cols-3">@for (c of d.classes; track c.code) { <div class="card"><strong>{{ c.coachType }}</strong><p class="stat"><b>{{ c.available }}</b><span>of {{ c.total }} seats free · {{ c.fare | currency: 'INR' : 'symbol' : '1.0-0' }}</span></p></div> }</div>
              } }
            } @else { <p class="muted">Loading…</p> }
          </div>
        </mat-tab>
      </mat-tab-group>
    </div>
    }`,
  styles: [`.tab{margin-top:16px}.tl{list-style:none;margin:0;padding:0 0 0 14px;border-left:3px solid var(--c-primary)}.tl li{position:relative;padding:0 0 18px 18px}.dot{position:absolute;left:-23px;top:3px;width:13px;height:13px;border-radius:50%;background:var(--c-surface);border:3px solid var(--c-primary)}
    .stop{display:flex;flex-direction:column}.sched{padding:8px 0;border-bottom:1px solid var(--c-border)}.coach-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:10px}.coach{display:flex;flex-direction:column;border:1px solid var(--c-border);border-radius:10px;padding:10px}`],
})
export class TrainDetailComponent {
  private readonly trains = inject(TrainService);
  /** Provided by the route resolver (`resolve: { train }`) through component input binding. */
  readonly train = input.required<Train | null>();
  readonly min = today();
  readonly date = new FormControl<Date>(addDays(today(), 1), { nonNullable: true });
  readonly coaches$: Observable<TrainCoach[]> = toObservable(this.train).pipe(switchMap((t) => (t ? this.trains.coaches(t.id) : of([] as TrainCoach[]))), shareReplay(1));
  /** combineLatest(train, date) -> switchMap: picking another date cancels the previous request. */
  readonly availability = toSignal(
    combineLatest([toObservable(this.train), this.date.valueChanges.pipe(startWith(this.date.value))]).pipe(
      switchMap(([t, d]) => (t ? this.trains.availability(t.id, toIsoDate(d)).pipe(
        map((data) => ({ data }) as { data?: TrainAvailability; error?: string }),
        catchError((e) => of({ error: (e as Error).message } as { data?: TrainAvailability; error?: string })),
        startWith(null),
      ) : of(null))),
    ),
    { initialValue: null as { data?: TrainAvailability; error?: string } | null },
  );
}
