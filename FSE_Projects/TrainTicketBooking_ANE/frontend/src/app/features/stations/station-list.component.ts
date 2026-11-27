import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { PageEvent } from '@angular/material/paginator';
import { Sort } from '@angular/material/sort';
import { BehaviorSubject, catchError, combineLatest, debounceTime, distinctUntilChanged, of, startWith, switchMap, tap } from 'rxjs';
import type { PageMeta, Station } from '../../core/models/models';
import { StationService } from '../../core/services/catalog.services';
import { toApiError } from '../../core/interceptors/error.interceptor';
import { Column, DataTableComponent } from '../../shared/components/data-table.component';
import { PageHeaderComponent } from '../../shared/components/ui.components';
import { sortParams } from '../../shared/utils';

@Component({
  selector: 'app-station-list', imports: [ReactiveFormsModule, MatFormFieldModule, MatInputModule, MatIconModule, DataTableComponent, PageHeaderComponent], changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="container">
      <app-page-header title="Stations" subtitle="Find a station and the trains that call at it" />
      <mat-form-field class="full"><mat-label>Search by name, code, city or state</mat-label><mat-icon matPrefix>search</mat-icon><input matInput [formControl]="q" /></mat-form-field>
      <app-data-table [columns]="columns" [rows]="rows()" [meta]="meta()" [loading]="loading()" [error]="error()" [clickable]="true" sortActive="name" sortDir="asc"
        (pageChange)="page$.next($event)" (sortChange)="sort$.next($event)" (rowClick)="open($event)" (retry)="retry$.next(retry$.value + 1)" />
    </div>`,
})
export class StationListComponent {
  private readonly stations = inject(StationService); private readonly router = inject(Router);
  readonly q = new FormControl('', { nonNullable: true });
  readonly page$ = new BehaviorSubject<PageEvent>({ pageIndex: 0, pageSize: 10, length: 0 });
  readonly sort$ = new BehaviorSubject<Sort>({ active: 'name', direction: 'asc' });
  readonly retry$ = new BehaviorSubject(0);
  readonly rows = signal<Station[]>([]); readonly meta = signal<PageMeta | null>(null); readonly loading = signal(true); readonly error = signal<string | null>(null);
  readonly columns: Column<Station>[] = [{ key: 'code', label: 'Code', sortable: true }, { key: 'name', label: 'Name', sortable: true }, { key: 'city', label: 'City', sortable: true }, { key: 'state', label: 'State', sortable: true }, { key: 'active', label: 'Status', kind: 'chip', value: (s) => (s.active ? 'ACTIVE' : 'INACTIVE') }];
  constructor() {
    combineLatest([this.q.valueChanges.pipe(startWith(''), debounceTime(300), distinctUntilChanged()), this.page$, this.sort$, this.retry$]).pipe(
      tap(() => { this.loading.set(true); this.error.set(null); }),
      switchMap(([q, page, sort]) => this.stations.list({ q: q.trim(), page: page.pageIndex, size: page.pageSize, ...sortParams(sort) }).pipe(catchError((e) => { this.error.set(toApiError(e).message); return of(null); }))),
      takeUntilDestroyed(),
    ).subscribe((r) => { this.loading.set(false); if (r) { this.rows.set(r.items); this.meta.set(r.meta); } });
  }
  open(s: Station) { void this.router.navigate(['/stations', s.id]); }
}
