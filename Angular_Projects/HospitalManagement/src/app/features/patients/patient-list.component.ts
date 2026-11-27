import { DatePipe, TitleCasePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSortModule, Sort } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router, RouterLink } from '@angular/router';
import { Store } from '@ngrx/store';
import { DEFAULT_PAGE_SIZE } from '../../core/configuration/app-config';
import { AuthService } from '../../core/auth/auth.service';
import type { Patient } from '../../core/models';
import { PatientsActions } from '../../state/actions/patients.actions';
import { selectPatientRows, selectPatientsError, selectPatientsLoading, selectPatientsPaging } from '../../state/selectors/patients.selectors';
import { PatientNamePipe } from '../../shared/pipes/pipes';
import { HighlightDirective, HasPermissionDirective } from '../../shared/directives/directives';
import { PageHeaderComponent, SearchBoxComponent, EmptyStateComponent, ErrorStateComponent } from '../../shared/components';
import { sortBy, ageFromDob, avatarUri } from '../../shared/utilities/helpers';

/**
 * Patient directory (Angular Material table + NgRx Entity).
 *  - `q` and `page` are QUERY PARAMETERS bound to signal inputs (component input binding) – the URL is the source of truth
 *  - an effect() dispatches `loadPage` whenever they change; the effect's switchMap in NgRx cancels stale requests
 *  - server-side pagination + search (`GET /patients?q=&page=&size=`), client-side column sorting of the loaded page
 *  - after a page arrives the next page is prefetched into the entity map (upsertMany)
 */
@Component({
  selector: 'app-patient-list',
  standalone: true,
  imports: [DatePipe, TitleCasePipe, MatTableModule, MatSortModule, MatPaginatorModule, MatButtonModule, MatIconModule, MatChipsModule, MatProgressBarModule, MatTooltipModule, RouterLink, PatientNamePipe, HighlightDirective, HasPermissionDirective, PageHeaderComponent, SearchBoxComponent, EmptyStateComponent, ErrorStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header title="Patients" subtitle="Search, review and manage registered patients">
      <a actions *appHasPermission="'patients:create'" mat-flat-button color="primary" routerLink="/patients/new"><mat-icon>person_add</mat-icon> Register patient</a>
    </app-page-header>
    <div class="mb-3"><app-search-box placeholder="Search name, e-mail or phone ( / )" [value]="q()" (search)="onSearch($event)" /></div>
    @if (loading()) { <mat-progress-bar mode="indeterminate" /> }
    @if (error(); as e) { <app-error-state [error]="e" (retry)="load()" /> }
    @else if (!loading() && rows().length === 0) { <app-empty-state [title]="q() ? 'No patients match your search' : 'No patients registered yet'" description="Try a different name, e-mail or phone number." /> }
    @else {
      <div class="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900" [style.opacity]="loading() ? 0.6 : 1">
        <table mat-table [dataSource]="sorted()" matSort (matSortChange)="sort.set($event)" aria-label="Patients" class="w-full">
          <ng-container matColumnDef="name"><th mat-header-cell *matHeaderCellDef mat-sort-header="name">Patient</th>
            <td mat-cell *matCellDef="let p"><div class="flex items-center gap-3 py-2"><img [src]="avatar(p)" alt="" width="36" height="36" loading="lazy" class="rounded-full" /><div><div class="font-semibold">{{ p | patientName }}</div><div class="text-xs text-slate-500">#{{ p.id }}</div></div></div></td></ng-container>
          <ng-container matColumnDef="age"><th mat-header-cell *matHeaderCellDef mat-sort-header="age">Age · Gender</th><td mat-cell *matCellDef="let p">{{ age(p) ?? '—' }} · {{ p.gender | titlecase }}</td></ng-container>
          <ng-container matColumnDef="contact"><th mat-header-cell *matHeaderCellDef>Contact</th><td mat-cell *matCellDef="let p"><div>{{ p.email }}</div><div class="text-xs text-slate-500">{{ p.phone }}</div></td></ng-container>
          <ng-container matColumnDef="registered"><th mat-header-cell *matHeaderCellDef mat-sort-header="registered">Registered</th><td mat-cell *matCellDef="let p">{{ p.createdAt | date: 'dd MMM yyyy' }}</td></ng-container>
          <ng-container matColumnDef="status"><th mat-header-cell *matHeaderCellDef>Status</th><td mat-cell *matCellDef="let p"><mat-chip [highlighted]="p.status === 'ACTIVE'">{{ p.status | titlecase }}</mat-chip></td></ng-container>
          <ng-container matColumnDef="actions"><th mat-header-cell *matHeaderCellDef></th>
            <td mat-cell *matCellDef="let p" class="text-right">
              <a mat-icon-button [routerLink]="[p.id]" matTooltip="Open" [attr.aria-label]="'Open ' + p.firstName"><mat-icon>visibility</mat-icon></a>
              <button mat-icon-button (click)="quickView(p); $event.stopPropagation()" matTooltip="Quick view (side panel, auxiliary route)" [attr.aria-label]="'Quick view ' + p.firstName"><mat-icon>vertical_split</mat-icon></button>
              <a *appHasPermission="'patients:update'" mat-icon-button [routerLink]="[p.id, 'edit']" matTooltip="Edit" [attr.aria-label]="'Edit ' + p.firstName"><mat-icon>edit</mat-icon></a>
            </td></ng-container>
          <tr mat-header-row *matHeaderRowDef="columns"></tr>
          <tr mat-row appHighlight *matRowDef="let row; columns: columns" class="cursor-pointer" (click)="open(row)"></tr>
        </table>
        <mat-paginator [length]="paging().totalElements" [pageIndex]="paging().page" [pageSize]="paging().size" [pageSizeOptions]="[5, 10, 20, 50]" (page)="onPage($event)" aria-label="Patients pages" />
      </div>
    }`,
})
export class PatientListComponent {
  private readonly store = inject(Store);
  private readonly router = inject(Router);
  private readonly pageSizeDefault = inject(DEFAULT_PAGE_SIZE); // overridden at ROUTE level (patients.routes.ts)
  protected readonly auth = inject(AuthService);

  /** Query parameters bound to inputs: /patients?q=asha&page=1&size=20 */
  // query params are bound by withComponentInputBinding; an ABSENT param arrives as `undefined` (it overwrites the default) → normalise with a transform
  readonly q = input('', { transform: (v: string | undefined | null) => v ?? '' });
  readonly page = input('0', { transform: (v: string | undefined | null) => v ?? '0' });
  readonly size = input('', { transform: (v: string | undefined | null) => v ?? '' });

  protected readonly rows = this.store.selectSignal(selectPatientRows);
  protected readonly paging = this.store.selectSignal(selectPatientsPaging);
  protected readonly loading = this.store.selectSignal(selectPatientsLoading);
  protected readonly error = this.store.selectSignal(selectPatientsError);
  protected readonly sort = signal<Sort>({ active: '', direction: '' });
  protected readonly columns = ['name', 'age', 'contact', 'registered', 'status', 'actions'];

  constructor() {
    effect(() => this.load()); // re-runs whenever q / page / size (query params) change
    effect(() => {
      const p = this.paging();
      if (!this.loading() && p.page + 1 < p.totalPages) this.store.dispatch(PatientsActions.prefetchNext({ q: p.q, page: p.page + 1, size: p.size }));
    });
  }

  protected sorted(): Patient[] {
    const s = this.sort();
    if (!s.active || !s.direction) return this.rows();
    const key: Record<string, (p: Patient) => string | number> = { name: (p) => `${p.lastName} ${p.firstName}`, age: (p) => ageFromDob(p.dateOfBirth) ?? 0, registered: (p) => p.createdAt };
    return sortBy(this.rows(), key[s.active] ?? (() => ''), s.direction === 'asc' ? 'asc' : 'desc');
  }
  protected readonly age = (p: Patient) => ageFromDob(p.dateOfBirth);
  protected readonly avatar = (p: Patient) => avatarUri(`${p.firstName} ${p.lastName}`, 72);

  load(): void { this.store.dispatch(PatientsActions.loadPage({ q: this.q(), page: Number(this.page()) || 0, size: Number(this.size()) || this.pageSizeDefault })); }
  protected onSearch(q: string): void { void this.router.navigate([], { queryParams: { q: q || null, page: null }, queryParamsHandling: 'merge' }); }
  protected onPage(e: PageEvent): void { void this.router.navigate([], { queryParams: { page: e.pageIndex || null, size: e.pageSize }, queryParamsHandling: 'merge' }); }
  /** Auxiliary route: opens `/patients(quick:quick-view/ID)` – the primary page stays, the NAMED outlet `quick` in the layout shows the panel. */
  protected quickView(p: Patient): void {
    void this.router.navigateByUrl(this.router.createUrlTree(['/', { outlets: { primary: ['patients'], quick: ['quick-view', p.id] } }], { queryParamsHandling: 'preserve' }));
  }
  protected open(p: Patient): void { void this.router.navigate(['/patients', p.id]); }
}
