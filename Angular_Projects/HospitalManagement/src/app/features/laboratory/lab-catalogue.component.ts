import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { BehaviorSubject, switchMap } from 'rxjs';
import { LaboratoryApiService } from '../../core/api/laboratory-api.service';
import { AuthService } from '../../core/auth/auth.service';
import type { LabTest } from '../../core/models';
import type { LoadState } from '../../core/models/api-error';
import { DataStateComponent, PageHeaderComponent } from '../../shared/components';
import { toLoadState } from '../../shared/utilities/load-state';

/** Lab test catalogue (PrimeNG p-table, client-side filter + sort – the endpoint returns an un-paged array). */
@Component({
  selector: 'app-lab-catalogue',
  standalone: true,
  imports: [CurrencyPipe, RouterLink, ButtonModule, InputTextModule, TableModule, PageHeaderComponent, DataStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header title="Laboratory" subtitle="Test catalogue">
      <span actions class="flex gap-2">
        <a routerLink="requests"><p-button label="Requests" severity="secondary" [outlined]="true" /></a>
        @if (auth.can('lab:request')) { <a routerLink="requests/new"><p-button label="New lab request" icon="pi pi-plus" /></a> }
      </span>
    </app-page-header>
    <app-data-state [state]="state()" emptyTitle="No tests in the catalogue" (retry)="reload$.next()">
      <ng-template #loaded let-tests>
        <input pInputText class="mb-3 w-full max-w-sm" placeholder="Filter by name, code or sample" aria-label="Filter tests" (input)="filter.set($any($event.target).value)" />
        <p-table [value]="filtered(tests)" [paginator]="true" [rows]="10" [rowsPerPageOptions]="[10, 25, 50]" sortField="name" [sortOrder]="1" styleClass="p-datatable-sm">
          <ng-template #header><tr><th pSortableColumn="code">Code <p-sortIcon field="code" /></th><th pSortableColumn="name">Test <p-sortIcon field="name" /></th><th>Sample</th><th pSortableColumn="turnaroundHours">Turnaround <p-sortIcon field="turnaroundHours" /></th><th pSortableColumn="price" class="text-right">Price <p-sortIcon field="price" /></th></tr></ng-template>
          <ng-template #body let-t><tr><td><b>{{ t.code }}</b></td><td>{{ t.name }}</td><td>{{ t.sampleType ?? '—' }}</td><td>{{ t.turnaroundHours ? t.turnaroundHours + ' h' : '—' }}</td><td class="text-right">{{ t.price | currency }}</td></tr></ng-template>
        </p-table>
      </ng-template>
    </app-data-state>`,
})
export class LabCatalogueComponent {
  protected readonly auth = inject(AuthService);
  private readonly api = inject(LaboratoryApiService);
  protected readonly reload$ = new BehaviorSubject<void>(undefined);
  protected readonly filter = signal('');
  protected readonly state = toSignal(this.reload$.pipe(switchMap(() => toLoadState(this.api.tests()))), { initialValue: { status: 'loading' } as LoadState<LabTest[]> });
  private readonly q = computed(() => this.filter().trim().toLowerCase());
  protected filtered(rows: LabTest[]) { const q = this.q(); return q ? rows.filter((t) => `${t.code} ${t.name} ${t.sampleType ?? ''}`.toLowerCase().includes(q)) : rows; }
}
