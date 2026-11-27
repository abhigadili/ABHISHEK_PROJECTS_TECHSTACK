import { ChangeDetectionStrategy, Component, Input, OnChanges, SimpleChanges, computed, inject, input } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Store } from '@ngrx/store';
import type { Department, Hospital } from '../../core/models';
import { HospitalsActions } from '../../state/actions/hospitals.actions';
import { selectDepartmentsOf, selectHospitalById } from '../../state/selectors/hospitals.selectors';
import { ConfirmService } from '../../shared/components';
import { HasPermissionDirective } from '../../shared/directives/directives';
import { HospitalContextService } from './hospital-context.service';
import { LegacyFacilityPanelComponent } from './legacy-facility-panel.component';
import { DoctorApiService } from '../../core/api/doctor-api.service';
import { catchError, map, of, switchMap } from 'rxjs';

/** Shared state of the hospital pages: the resolved hospital as a signal (component-level provider on the details page). */
@Component({
  selector: 'app-hospital-details',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, HasPermissionDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (hospital; as h) {
      <div class="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
        <div class="flex flex-wrap items-start justify-between gap-3"><div><h1 class="text-2xl font-bold">{{ h.name }}</h1><p class="text-sm text-slate-500">{{ h.address || 'Address not recorded' }}{{ h.city ? ', ' + h.city : '' }} · code {{ h.code }} · {{ h.active ? 'active' : 'inactive' }}</p></div>
          <div class="flex gap-2">@if (h.active && ctx.activeId() !== h.id) { <button class="rounded-md border px-3 py-2 text-sm" (click)="ctx.set(h.id)">Set as active</button> }<a *appHasPermission="'hospitals:manage'" routerLink="edit" class="rounded-md border px-3 py-2 text-sm no-underline">Edit</a><button *appHasPermission="'hospitals:manage'" class="rounded-md border border-red-300 px-3 py-2 text-sm text-red-700 disabled:opacity-40" [disabled]="!h.active" (click)="deactivate(h)">Deactivate</button></div></div>
        <nav class="mt-4 flex gap-1 border-b" aria-label="Hospital sections">@for (t of tabs; track t.path) { <a [routerLink]="t.path" routerLinkActive="border-b-2 border-brand-600 text-brand-600" [routerLinkActiveOptions]="{ exact: t.path === '.' }" class="px-4 py-2 text-sm font-medium no-underline">{{ t.label }}</a> }</nav>
      </div>
      <div class="mt-4"><router-outlet /></div>
    } @else { <p class="p-8 text-center text-slate-500">Hospital could not be loaded.</p> }`,
})
export class HospitalDetailsComponent implements OnChanges {
  @Input() hospital: Hospital | null = null;
  protected readonly ctx = inject(HospitalContextService);
  private readonly store = inject(Store);
  private readonly confirm = inject(ConfirmService);
  private readonly router = inject(Router);
  protected readonly tabs = [{ path: '.', label: 'Overview' }, { path: 'departments', label: 'Departments' }, { path: 'facilities', label: 'Facilities' }];
  ngOnChanges(c: SimpleChanges) { if (c['hospital'] && this.hospital) { this.store.dispatch(HospitalsActions.saveHospitalSuccess({ hospital: this.hospital, created: false })); this.store.dispatch(HospitalsActions.loadDepartments({ hospitalId: this.hospital.id })); } }
  protected deactivate(h: Hospital) { this.confirm.confirm({ title: 'Deactivate hospital?', message: 'Doctors and departments stay in the system but the hospital is hidden from new selections.', confirmLabel: 'Deactivate', destructive: true }).subscribe((r) => { if (r.confirmed) { this.store.dispatch(HospitalsActions.deactivateHospital({ id: h.id })); void this.router.navigate(['/hospitals']); } }); }
}


/** Helper: hospital id (route param bound as input) → NgRx selectors as signals. */
function hospitalSignals(id: () => string) {
  const store = inject(Store);
  const numeric = computed(() => Number(id()));
  const hospital = toSignal(toObservable(numeric).pipe(switchMap((i) => store.select(selectHospitalById(i)))), { initialValue: null as Hospital | null });
  const departments = toSignal(toObservable(numeric).pipe(switchMap((i) => store.select(selectDepartmentsOf(i)))), { initialValue: [] as Department[] });
  return { store, numeric, hospital, departments };
}

@Component({
  selector: 'app-hospital-overview',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="bs-scope"><div class="row g-3"><div class="col-12 col-lg-8"><div class="card"><div class="card-body"><dl class="row mb-0">@for (f of facts(); track f[0]) { <dt class="col-sm-4 text-muted fw-normal">{{ f[0] }}</dt><dd class="col-sm-8">{{ f[1] || '—' }}</dd> }</dl></div></div></div>
    <div class="col-12 col-lg-4"><div class="card text-center"><div class="card-body"><div class="display-6">{{ s.departments().length }}</div><div class="text-muted">departments</div><hr /><div class="display-6">{{ doctorCount() ?? '…' }}</div><div class="text-muted">doctors</div></div></div></div></div></div>`,
})
export class HospitalOverviewComponent {
  readonly hospitalId = input.required<string>();
  private readonly doctors = inject(DoctorApiService);
  protected readonly s = hospitalSignals(() => this.hospitalId());
  protected readonly doctorCount = toSignal(toObservable(this.s.numeric).pipe(switchMap((id) => this.doctors.list({ hospitalId: id, size: 1 }).pipe(map((p) => p.totalElements as number | null), catchError(() => of(null))))), { initialValue: null as number | null });
  protected readonly facts = computed<[string, string | null][]>(() => { const h = this.s.hospital(); return h ? [['Name', h.name], ['Code', h.code], ['Address', h.address], ['City', h.city], ['Phone', h.phone], ['E-mail', h.email]] : []; });
}

/** Department CRUD (Bootstrap). The inline add/edit form is TEMPLATE-DRIVEN (ngForm + ngModel + required/maxlength). Changes go through NgRx effects (concatMap). */
@Component({
  selector: 'app-hospital-departments',
  standalone: true,
  imports: [FormsModule, HasPermissionDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bs-scope">
      <form *appHasPermission="'hospitals:manage'" #f="ngForm" (ngSubmit)="save(f)" class="row g-2 align-items-start mb-3" novalidate aria-label="Department form">
        <div class="col-12 col-md-4"><input class="form-control" [class.is-invalid]="name.invalid && (name.touched || f.submitted)" name="name" [(ngModel)]="draft.name" #name="ngModel" required maxlength="100" placeholder="Department name" aria-label="Department name" /><div class="invalid-feedback">Department name is required</div></div>
        <div class="col-12 col-md-5"><input class="form-control" name="description" [(ngModel)]="draft.description" maxlength="255" placeholder="Description (optional)" aria-label="Department description" /></div>
        <div class="col-12 col-md-3 d-flex gap-2"><button class="btn btn-primary" type="submit">{{ editingId ? 'Update' : 'Add department' }}</button>@if (editingId) { <button class="btn btn-outline-secondary" type="button" (click)="cancel(f)">Cancel</button> }</div>
      </form>
      <ul class="list-group">@for (d of s.departments(); track d.id) { <li class="list-group-item d-flex justify-content-between align-items-center"><div><div class="fw-semibold">{{ d.name }}</div><div class="small text-muted">{{ d.description || 'No description' }}</div></div>
        <div *appHasPermission="'hospitals:manage'" class="btn-group btn-group-sm"><button class="btn btn-outline-secondary" (click)="edit(d)" [attr.aria-label]="'Edit ' + d.name">Edit</button><button class="btn btn-outline-danger" (click)="remove(d)" [attr.aria-label]="'Remove ' + d.name">Remove</button></div></li> }
        @empty { <li class="list-group-item text-muted">No departments yet.</li> }</ul>
    </div>`,
})
export class HospitalDepartmentsComponent {
  readonly hospitalId = input.required<string>();
  private readonly confirm = inject(ConfirmService);
  protected readonly s = hospitalSignals(() => this.hospitalId());
  protected draft = { name: '', description: '' };
  protected editingId: number | null = null;
  protected save(f: { valid: boolean | null; resetForm: () => void }) {
    if (!f.valid) return;
    this.s.store.dispatch(HospitalsActions.saveDepartment({ hospitalId: this.s.numeric(), id: this.editingId ?? undefined, department: { name: this.draft.name.trim(), description: this.draft.description.trim() || undefined } }));
    this.editingId = null; f.resetForm();
  }
  protected edit(d: Department) { this.editingId = d.id; this.draft = { name: d.name, description: d.description ?? '' }; }
  protected cancel(f: { resetForm: () => void }) { this.editingId = null; f.resetForm(); }
  protected remove(d: Department) { this.confirm.confirm({ title: `Remove ${d.name}?`, message: 'Doctors assigned to this department keep their record.', confirmLabel: 'Remove', destructive: true }).subscribe((r) => { if (r.confirmed) this.s.store.dispatch(HospitalsActions.deleteDepartment({ id: d.id })); }); }
}

/** Facilities: the backend has no facility/branch resource – the departments are shown as facility tiles (traditional directives panel). */
@Component({
  selector: 'app-hospital-facilities',
  standalone: true,
  imports: [LegacyFacilityPanelComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="bs-scope"><div class="alert alert-info">The backend has no separate facility or branch resource. Facilities are shown as the departments of this hospital; branches are separate hospital records.</div><app-legacy-facility-panel [departments]="activeDepartments()" /></div>`,
})
export class HospitalFacilitiesComponent {
  readonly hospitalId = input.required<string>();
  protected readonly s = hospitalSignals(() => this.hospitalId());
  protected readonly activeDepartments = computed(() => this.s.departments().filter((d) => d.active));
}
