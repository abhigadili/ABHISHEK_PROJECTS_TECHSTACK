import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Store } from '@ngrx/store';
import { HospitalsActions } from '../../state/actions/hospitals.actions';
import { selectAllHospitals, selectHospitalsError, selectHospitalsLoading } from '../../state/selectors/hospitals.selectors';
import { EmptyStateComponent, ErrorStateComponent, PageHeaderComponent, PagerComponent, SearchBoxComponent, SkeletonComponent } from '../../shared/components';
import { HasPermissionDirective } from '../../shared/directives/directives';
import { HospitalCardComponent } from './hospital-card.component';
import { CardExpansionState, HOSPITAL_PAGE_SIZE } from './hospital-context.service';

/** Hospital directory (Bootstrap grid inside `.bs-scope`). Data from the NgRx hospitals slice; page size from a route-level token (useFactory). */
@Component({
  selector: 'app-hospital-list',
  standalone: true,
  imports: [RouterLink, HospitalCardComponent, PageHeaderComponent, SearchBoxComponent, EmptyStateComponent, ErrorStateComponent, SkeletonComponent, PagerComponent, HasPermissionDirective],
  providers: [CardExpansionState],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header title="Hospitals" subtitle="Hospitals, their departments and facilities"><a actions *appHasPermission="'hospitals:manage'" routerLink="new" class="rounded-md bg-brand-600 px-3 py-2 text-sm font-semibold text-white no-underline">Add hospital</a></app-page-header>
    <div class="bs-scope">
      <div class="row g-2 mb-3 align-items-end">
        <div class="col-12 col-md-5"><app-search-box placeholder="Search hospitals…" [(value)]="query" /></div>
        <div class="col-6 col-md-3"><label class="form-label small mb-1" for="city">City</label><select id="city" class="form-select form-select-sm" [value]="city()" (change)="city.set($any($event.target).value); page.set(0)"><option value="">All cities</option>@for (c of cities(); track c) { <option [value]="c">{{ c }}</option> }</select></div>
        <div class="col-6 col-md-4"><div class="form-check form-switch"><input id="inactive" class="form-check-input" type="checkbox" role="switch" [checked]="showInactive()" (change)="showInactive.set($any($event.target).checked)" /><label class="form-check-label small" for="inactive">Show inactive</label></div></div>
      </div>
      @if (error(); as e) { <app-error-state [error]="e" (retry)="reload()" /> }
      @else if (loading() && all().length === 0) { <app-skeleton [rows]="3" /> }
      @else if (visible().length === 0) { <app-empty-state title="No hospitals found" description="Change the search or filters." /> }
      @else {
        <div class="row g-3">@for (h of pageItems(); track h.id) { <div class="col-12 col-md-6 col-xl-4"><app-hospital-card [hospital]="h" /></div> }</div>
        <app-pager [page]="page()" [size]="size" [total]="visible().length" label="hospitals" (pageChange)="page.set($event)" />
      }
    </div>`,
})
export class HospitalListComponent {
  private readonly store = inject(Store);
  protected readonly size = inject(HOSPITAL_PAGE_SIZE); // overridden by the route providers
  protected readonly all = this.store.selectSignal(selectAllHospitals);
  protected readonly loading = this.store.selectSignal(selectHospitalsLoading);
  protected readonly error = this.store.selectSignal(selectHospitalsError);
  protected readonly query = signal('');
  protected readonly city = signal('');
  protected readonly showInactive = signal(false);
  protected readonly page = signal(0);
  protected readonly cities = computed(() => [...new Set(this.all().map((h) => h.city).filter((c): c is string => !!c))].sort());
  protected readonly visible = computed(() => { const q = this.query().trim().toLowerCase(); return this.all().filter((h) => (this.showInactive() || h.active) && (!this.city() || h.city === this.city()) && (!q || [h.name, h.code, h.city ?? '', h.address ?? ''].some((x) => x.toLowerCase().includes(q)))); });
  protected readonly pageItems = computed(() => this.visible().slice(this.page() * this.size, (this.page() + 1) * this.size));
  constructor() { this.reload(); }
  protected reload() { this.store.dispatch(HospitalsActions.load({ force: true })); }
}
