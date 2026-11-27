import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { combineLatest, map, startWith } from 'rxjs';
import type { Train } from '../../core/models/models';
import { TrainService } from '../../core/services/catalog.services';
import { ToastService } from '../../core/services/toast.service';
import { toApiError } from '../../core/interceptors/error.interceptor';
import { Column, DataTableComponent } from '../../shared/components/data-table.component';
import { ConfirmService, PageHeaderComponent } from '../../shared/components/ui.components';
import { CanDirective } from '../../shared/directives/directives';
import { listState } from '../../shared/list-state';

@Component({
  selector: 'app-trains-admin', imports: [ReactiveFormsModule, RouterLink, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule, MatSelectModule, DataTableComponent, PageHeaderComponent, CanDirective], changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header title="Trains" subtitle="Fleet, routes and operating status"><a *appCan="'train:manage'" mat-flat-button routerLink="new"><mat-icon>add</mat-icon>New train</a></app-page-header>
    <div class="card row" style="margin-bottom:16px">
      <mat-form-field style="flex:2;min-width:200px"><mat-label>Search</mat-label><mat-icon matPrefix>search</mat-icon><input matInput [formControl]="l.search" /></mat-form-field>
      <mat-form-field style="flex:1;min-width:140px"><mat-label>Status</mat-label><mat-select [formControl]="status"><mat-option value="">All</mat-option><mat-option value="ACTIVE">Active</mat-option><mat-option value="INACTIVE">Inactive</mat-option><mat-option value="SUSPENDED">Suspended</mat-option></mat-select></mat-form-field>
      <mat-form-field style="flex:1;min-width:140px"><mat-label>Type</mat-label><mat-select [formControl]="type"><mat-option value="">All</mat-option>@for (t of types; track t) { <mat-option [value]="t">{{ t }}</mat-option> }</mat-select></mat-form-field>
    </div>
    <app-data-table [columns]="columns" [rows]="l.rows()" [meta]="l.meta()" [loading]="l.loading()" [error]="l.error()" [clickable]="true" [sortActive]="l.sortActive" [sortDir]="l.sortDir" (pageChange)="l.page$.next($event)" (sortChange)="l.sort$.next($event)" (rowClick)="open($event)" (retry)="l.reload()">
      <ng-template #actions let-t>
        <a mat-icon-button [routerLink]="[t.id]" (click)="$event.stopPropagation()" aria-label="Details"><mat-icon>visibility</mat-icon></a>
        <a *appCan="'train:manage'" mat-icon-button [routerLink]="[t.id, 'edit']" (click)="$event.stopPropagation()" aria-label="Edit"><mat-icon>edit</mat-icon></a>
        <button *appCan="'train:manage'" mat-icon-button (click)="$event.stopPropagation(); remove(t)" aria-label="Delete"><mat-icon>delete</mat-icon></button>
      </ng-template>
    </app-data-table>`,
})
export class TrainsAdminComponent {
  private readonly api = inject(TrainService); private readonly router = inject(Router); private readonly toast = inject(ToastService); private readonly confirm = inject(ConfirmService);
  readonly types = ['EXPRESS', 'SUPERFAST', 'SUBURBAN', 'PASSENGER', 'PREMIUM'];
  readonly status = new FormControl('', { nonNullable: true }); readonly type = new FormControl('', { nonNullable: true });
  readonly l = listState<Train>((q) => this.api.list(q), { sort: 'number' }, combineLatest([this.status.valueChanges.pipe(startWith('')), this.type.valueChanges.pipe(startWith(''))]).pipe(map(([status, type]) => ({ status, type }))));
  readonly columns: Column<Train>[] = [
    { key: 'number', label: 'Number', sortable: true }, { key: 'name', label: 'Name', sortable: true }, { key: 'type', label: 'Type', sortable: true },
    { key: 'route', label: 'Route', value: (t) => (t.route?.stops.length ? `${t.route.stops[0].station.code} → ${t.route.stops[t.route.stops.length - 1].station.code}` : '— no route —') },
    { key: 'coaches', label: 'Coaches', value: (t) => t._count?.coaches ?? 0 }, { key: 'bookings', label: 'Bookings', value: (t) => t._count?.bookings ?? 0 }, { key: 'status', label: 'Status', kind: 'chip', sortable: true },
  ];
  open(t: Train) { void this.router.navigate(['/admin/trains', t.id]); }
  async remove(t: Train) { if (await this.confirm.ask({ title: 'Delete train?', message: `${t.number} ${t.name} will be deleted. Trains with bookings cannot be deleted - deactivate them instead.`, confirmText: 'Delete', danger: true })) this.api.remove(t.id).subscribe({ next: () => { this.toast.success('Train deleted.'); this.l.reload(); }, error: (e) => this.toast.error(toApiError(e).message) }); }
}
