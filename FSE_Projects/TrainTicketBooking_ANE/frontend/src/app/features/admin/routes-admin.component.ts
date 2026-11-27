import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import type { TrainRoute } from '../../core/models/models';
import { TrainService } from '../../core/services/catalog.services';
import { Column, DataTableComponent } from '../../shared/components/data-table.component';
import { PageHeaderComponent } from '../../shared/components/ui.components';
import { CanDirective } from '../../shared/directives/directives';
import { listState } from '../../shared/list-state';

@Component({
  selector: 'app-routes-admin', imports: [ReactiveFormsModule, RouterLink, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule, DataTableComponent, PageHeaderComponent, CanDirective], changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header title="Routes" subtitle="Stops, timings and distances per train"><a *appCan="'train:manage'" mat-flat-button routerLink="new"><mat-icon>add</mat-icon>New route</a></app-page-header>
    <mat-form-field class="full"><mat-label>Search route or train</mat-label><mat-icon matPrefix>search</mat-icon><input matInput [formControl]="l.search" /></mat-form-field>
    <app-data-table [columns]="columns" [rows]="l.rows()" [meta]="l.meta()" [loading]="l.loading()" [error]="l.error()" (pageChange)="l.page$.next($event)" (retry)="l.reload()">
      <ng-template #actions let-r><a *appCan="'train:manage'" mat-icon-button [routerLink]="[r.id, 'edit']" [attr.aria-label]="'Edit ' + r.name"><mat-icon>edit</mat-icon></a></ng-template>
    </app-data-table>`,
})
export class RoutesAdminComponent {
  private readonly api = inject(TrainService);
  readonly l = listState<TrainRoute>((q) => this.api.routes(q));
  readonly columns: Column<TrainRoute>[] = [
    { key: 'name', label: 'Route' }, { key: 'train', label: 'Train', value: (r) => (r.train ? `${r.train.number} ${r.train.name}` : '') },
    { key: 'stops', label: 'Stops', value: (r) => r.stops.length }, { key: 'path', label: 'From → To', value: (r) => `${r.stops[0]?.station.code} → ${r.stops[r.stops.length - 1]?.station.code}` },
    { key: 'km', label: 'Distance (km)', align: 'end', value: (r) => r.stops[r.stops.length - 1]?.distanceKm ?? 0 },
  ];
}
