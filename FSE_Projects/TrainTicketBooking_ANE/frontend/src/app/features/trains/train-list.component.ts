import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { PageEvent } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { Sort } from '@angular/material/sort';
import { BehaviorSubject, catchError, combineLatest, debounceTime, distinctUntilChanged, of, startWith, switchMap, tap } from 'rxjs';
import type { PageMeta, Train } from '../../core/models/models';
import { TrainService } from '../../core/services/catalog.services';
import { toApiError } from '../../core/interceptors/error.interceptor';
import { Column, DataTableComponent } from '../../shared/components/data-table.component';
import { PageHeaderComponent } from '../../shared/components/ui.components';
import { sortParams } from '../../shared/utils';

/** Public train directory: search box (debounced) + filters + paging + sorting combined with combineLatest -> switchMap. */
@Component({
  selector: 'app-train-list', imports: [ReactiveFormsModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatIconModule, DataTableComponent, PageHeaderComponent], changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="container">
      <app-page-header title="Trains" subtitle="Every train in the network" />
      <div class="card row" style="margin-bottom:16px">
        <mat-form-field style="flex:2;min-width:220px"><mat-label>Search by name or number</mat-label><mat-icon matPrefix>search</mat-icon><input matInput [formControl]="q" /></mat-form-field>
        <mat-form-field style="flex:1;min-width:150px"><mat-label>Type</mat-label><mat-select [formControl]="type"><mat-option value="">All</mat-option>@for (t of types; track t) { <mat-option [value]="t">{{ t }}</mat-option> }</mat-select></mat-form-field>
      </div>
      <app-data-table [columns]="columns" [rows]="rows()" [meta]="meta()" [loading]="loading()" [error]="error()" [clickable]="true" sortActive="number" sortDir="asc"
        (pageChange)="page$.next($event)" (sortChange)="sort$.next($event)" (rowClick)="open($event)" (retry)="retry$.next(retry$.value + 1)" />
    </div>`,
})
export class TrainListComponent {
  private readonly trains = inject(TrainService); private readonly router = inject(Router);
  readonly types = ['EXPRESS', 'SUPERFAST', 'SUBURBAN', 'PASSENGER', 'PREMIUM'];
  readonly q = new FormControl('', { nonNullable: true }); readonly type = new FormControl('', { nonNullable: true });
  readonly page$ = new BehaviorSubject<PageEvent>({ pageIndex: 0, pageSize: 10, length: 0 });
  readonly sort$ = new BehaviorSubject<Sort>({ active: 'number', direction: 'asc' });
  readonly retry$ = new BehaviorSubject(0);
  readonly rows = signal<Train[]>([]); readonly meta = signal<PageMeta | null>(null); readonly loading = signal(true); readonly error = signal<string | null>(null);
  readonly columns: Column<Train>[] = [
    { key: 'number', label: 'Number', sortable: true }, { key: 'name', label: 'Name', sortable: true }, { key: 'type', label: 'Type', sortable: true },
    { key: 'route', label: 'Route', value: (t) => t.route ? `${t.route.stops[0]?.station.code} → ${t.route.stops[t.route.stops.length - 1]?.station.code}` : '—' },
    { key: 'status', label: 'Status', kind: 'chip', sortable: true },
  ];
  constructor() {
    combineLatest([this.q.valueChanges.pipe(startWith(''), debounceTime(300), distinctUntilChanged()), this.type.valueChanges.pipe(startWith('')), this.page$, this.sort$, this.retry$]).pipe(
      tap(() => { this.loading.set(true); this.error.set(null); }),
      switchMap(([q, type, page, sort]) => this.trains.list({ q: q.trim(), type, page: page.pageIndex, size: page.pageSize, ...sortParams(sort) }).pipe(catchError((e) => { this.error.set(toApiError(e).message); return of(null); }))),
      takeUntilDestroyed(),
    ).subscribe((r) => { this.loading.set(false); if (r) { this.rows.set(r.items); this.meta.set(r.meta); } });
  }
  open(t: Train) { void this.router.navigate(['/trains', t.id]); }
}
