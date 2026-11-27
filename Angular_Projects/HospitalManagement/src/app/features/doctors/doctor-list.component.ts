import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import { Action, Store } from '@ngrx/store';
import { debounceTime, distinctUntilChanged, skip } from 'rxjs';

import type { Doctor } from '../../core/models';
import * as A from '../../state/actions/doctors.actions';
import { HospitalsActions } from '../../state/actions/hospitals.actions';
import { selectAllDepartments } from '../../state/selectors/hospitals.selectors';
import { selectCompareDoctors, selectCompareIds, selectDoctorFilters, selectDoctorPage, selectDoctorsError, selectDoctorsLoading, selectHasActiveFilters, selectSpecializations } from '../../state/selectors/doctors.selectors';
import { EmptyStateComponent, ErrorStateComponent, PageHeaderComponent, SkeletonComponent } from '../../shared/components';
import { HasPermissionDirective } from '../../shared/directives/directives';
import { SpecializationPipe } from '../../shared/pipes/pipes';
import { avatarUri } from '../../shared/utilities/helpers';
import { DoctorCompareDialogComponent } from './doctor-compare-dialog.component';
import { DoctorApiService } from '../../core/api/doctor-api.service';

/**
 * Doctor directory (Angular Material + NgRx Store/Entity/Selectors/Effects).
 *  - doctors live in the NgRx entity collection; filters, sort, paging and the compare tray are nested feature state
 *  - the search box is a signal → toObservable → debounceTime → distinctUntilChanged → dispatch(searchChanged)
 *  - everything shown is a memoised selector (filter → sort → page slice), read as signals with `store.selectSignal`
 *  - hover prefetches the doctor detail via the API (HttpClient) – cheap warm-up for the details route resolver
 */
@Component({
  selector: 'app-doctor-list',
  standalone: true,
  imports: [CurrencyPipe, RouterLink, MatTableModule, MatButtonModule, MatIconModule, MatFormFieldModule, MatSelectModule, MatSlideToggleModule, MatPaginatorModule, MatCheckboxModule, MatChipsModule, MatTooltipModule, MatDialogModule, PageHeaderComponent, EmptyStateComponent, ErrorStateComponent, SkeletonComponent, HasPermissionDirective, SpecializationPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header title="Doctors" subtitle="Find a specialist, check schedules and availability">
      <a actions *appHasPermission="'doctors:manage'" mat-flat-button color="primary" routerLink="new"><mat-icon>person_add</mat-icon> Add doctor</a>
    </app-page-header>
    <div class="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
      <input class="h-10 w-64 rounded-md border border-slate-300 bg-transparent px-3 text-sm dark:border-slate-600" placeholder="Search name, specialty, e-mail…" aria-label="Search doctors" [value]="search()" (input)="search.set($any($event.target).value)" />
      <mat-form-field subscriptSizing="dynamic" class="w-48"><mat-label>Specialization</mat-label><mat-select [value]="filters().specialization" (selectionChange)="dispatch(spec($event.value))"><mat-option value="">All</mat-option>@for (s of specializations(); track s) { <mat-option [value]="s">{{ s }}</mat-option> }</mat-select></mat-form-field>
      <mat-form-field subscriptSizing="dynamic" class="w-52"><mat-label>Department</mat-label><mat-select [value]="filters().departmentId" (selectionChange)="dispatch(dept($event.value))"><mat-option [value]="null">All</mat-option>@for (d of departments(); track d.id) { <mat-option [value]="d.id">{{ d.name }}</mat-option> }</mat-select></mat-form-field>
      <mat-slide-toggle [checked]="filters().onlyActive" (change)="dispatch(active($event.checked))">Active only</mat-slide-toggle>
      @if (hasFilters()) { <button mat-button (click)="dispatch(reset())">Reset filters</button> }
      <span class="flex-1"></span>
      <button mat-stroked-button [disabled]="compare().length < 2" (click)="openCompare()"><mat-icon>compare_arrows</mat-icon> Compare ({{ compare().length }}/3)</button>
      @if (compare().length) { <button mat-button (click)="dispatch(clear())">Clear</button> }
    </div>
    <div class="mb-3 flex items-center gap-2 text-sm text-slate-500">Sort by:
      @for (k of sortKeys; track k.key) { <button type="button" class="rounded-full border px-3 py-1 hover:bg-slate-50 dark:hover:bg-slate-800" [class.border-brand-600]="filters().sortKey === k.key" (click)="dispatch(sort(k.key))">{{ k.label }}{{ filters().sortKey === k.key ? (filters().sortDir === 'asc' ? ' ↑' : ' ↓') : '' }}</button> }</div>
    @if (error(); as e) { <app-error-state [error]="e" (retry)="reload()" /> }
    @else if (loading() && page().total === 0) { <app-skeleton [rows]="4" /> }
    @else if (page().total === 0) { <app-empty-state title="No doctors match" description="Adjust the filters or search term." /> }
    @else {
      <div class="hms-grid-auto">
        @for (d of page().items; track d.id) {
          <article class="flex flex-col rounded-xl border bg-white p-4 shadow-sm dark:bg-slate-900" [class]="isCompared(d.id) ? 'border-brand-600' : 'border-slate-200 dark:border-slate-700'" [class.opacity-60]="!d.active" (mouseenter)="prefetch(d.id)">
            <a [routerLink]="[d.id]" class="flex gap-3 no-underline text-inherit">
              <img [src]="avatar(d)" alt="" width="56" height="56" loading="lazy" class="rounded-full" />
              <div class="min-w-0"><div class="truncate font-bold">{{ d.fullName }}</div><div class="text-sm text-brand-600">{{ d.specialization | specialization }}</div><div class="truncate text-xs text-slate-500">{{ deptName(d) }}</div></div>
            </a>
            <div class="mt-3 flex flex-wrap gap-2 text-xs"><span class="rounded-full border px-2 py-0.5">{{ d.experienceYears ?? '—' }} yrs</span><span class="rounded-full border px-2 py-0.5">{{ d.consultationFee | currency: 'INR' }} / visit</span>@if (!d.active) { <span class="rounded-full bg-slate-200 px-2 py-0.5">Inactive</span> }</div>
            <mat-checkbox class="mt-2" [checked]="isCompared(d.id)" (change)="dispatch(toggle(d.id))">Compare</mat-checkbox>
          </article>
        }
      </div>
      <mat-paginator class="mt-4 rounded-xl" [length]="page().total" [pageIndex]="page().page" [pageSize]="filters().pageSize" [pageSizeOptions]="[8, 16, 32]" (page)="onPage($event)" aria-label="Doctor pages" />
    }`,
})
export class DoctorListComponent {
  private readonly store = inject(Store);
  private readonly dialog = inject(MatDialog);
  private readonly doctorApi = inject(DoctorApiService);
  protected readonly dispatch = (a: Action) => this.store.dispatch(a);

  protected readonly filters = this.store.selectSignal(selectDoctorFilters);
  protected readonly page = this.store.selectSignal(selectDoctorPage);
  protected readonly loading = this.store.selectSignal(selectDoctorsLoading);
  protected readonly error = this.store.selectSignal(selectDoctorsError);
  protected readonly hasFilters = this.store.selectSignal(selectHasActiveFilters);
  protected readonly specializations = this.store.selectSignal(selectSpecializations);
  protected readonly departments = this.store.selectSignal(selectAllDepartments);
  protected readonly compare = this.store.selectSignal(selectCompareDoctors);
  private readonly compareIds = this.store.selectSignal(selectCompareIds);
  protected readonly deptNames = computed(() => new Map(this.departments().map((d) => [d.id, d.name])));

  /** Search text signal → Observable → debounce → distinct → store (RxJS ↔ Signals interop). */
  protected readonly search = signal(this.store.selectSignal(selectDoctorFilters)().search);
  protected readonly sortKeys = [{ key: 'fullName', label: 'Name' }, { key: 'specialization', label: 'Specialty' }, { key: 'experienceYears', label: 'Experience' }, { key: 'consultationFee', label: 'Fee' }] as const;
  protected readonly spec = (specialization: string) => A.specializationChanged({ specialization });
  protected readonly dept = (departmentId: number | null) => A.departmentChanged({ departmentId });
  protected readonly active = (onlyActive: boolean) => A.onlyActiveChanged({ onlyActive });
  protected readonly sort = (key: (typeof this.sortKeys)[number]['key']) => A.sortChanged({ key });
  protected readonly toggle = (id: number) => A.compareToggled({ id });
  protected readonly reset = () => A.filtersReset();
  protected readonly clear = () => A.compareCleared();

  constructor() {
    this.reload();
    this.store.dispatch(HospitalsActions.load({}));
    toObservable(this.search).pipe(skip(1), debounceTime(300), distinctUntilChanged()).subscribe((search) => this.store.dispatch(A.searchChanged({ search })));
  }
  protected reload() { this.store.dispatch(A.loadDoctors({})); }
  protected isCompared(id: number) { return this.compareIds().includes(id); }
  protected deptName(d: Doctor) { return (d.departmentId ? this.deptNames().get(d.departmentId) : null) ?? (d.departmentId ? `Department #${d.departmentId}` : 'No department'); }
  protected avatar(d: Doctor) { return avatarUri(d.fullName, 112); }
  protected onPage(e: PageEvent) { this.store.dispatch(A.pageChanged({ page: e.pageIndex, pageSize: e.pageSize })); }
  protected prefetch(id: number) { this.doctorApi.getById(id).subscribe({ error: () => undefined }); }
  protected openCompare() { this.dialog.open(DoctorCompareDialogComponent, { data: this.compare(), width: '720px' }); }
}
