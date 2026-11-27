import { LowerCasePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, Input, OnChanges, OnDestroy, OnInit, SimpleChanges, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Store } from '@ngrx/store';
import { AuthService } from '../../core/auth/auth.service';
import type { Patient } from '../../core/models';
import { LoggingService } from '../../core/services/logging.service';
import { ConfirmService } from '../../shared/components';
import { PatientNamePipe } from '../../shared/pipes/pipes';
import { HasPermissionDirective } from '../../shared/directives/directives';
import { PatientsActions } from '../../state/actions/patients.actions';
import { ageFromDob, avatarUri } from '../../shared/utilities/helpers';
import { PatientContextService } from './patient-context.service';

/**
 * Patient details = LAYOUT component with routed tabs (child routes) – Angular Material tab navigation.
 *  - `@Input() patient` is filled by the route RESOLVER through component input binding; traditional input → ngOnChanges fires.
 *  - `providers: [PatientContextService]` = component-level provider: the tabs below share this instance (hierarchical DI).
 *  - lifecycle: ngOnChanges (resolved patient arrived) → ngOnInit → ngOnDestroy (cleanup log).
 */
@Component({
  selector: 'app-patient-details',
  standalone: true,
  imports: [LowerCasePipe, RouterOutlet, RouterLink, RouterLinkActive, MatTabsModule, MatButtonModule, MatIconModule, MatChipsModule, PatientNamePipe, HasPermissionDirective],
  providers: [PatientContextService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (patient; as p) {
      <div class="mb-4 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
        <div class="flex items-center gap-4">
          <img [src]="avatar(p)" alt="" width="64" height="64" loading="lazy" class="rounded-full" />
          <div><h1 class="text-2xl font-bold">{{ p | patientName }}</h1>
            <p class="text-sm text-slate-500">Patient #{{ p.id }} · {{ age(p) ?? '—' }} y · {{ p.gender | lowercase }}@if (p.bloodGroup) { · {{ p.bloodGroup }} }</p>
            <div class="mt-1 flex flex-wrap gap-2"><mat-chip [highlighted]="p.status === 'ACTIVE'">{{ p.status }}</mat-chip>@if (p.knownAllergies) { <mat-chip class="!bg-amber-100">Allergies: {{ p.knownAllergies }}</mat-chip> }</div></div>
        </div>
        <div class="flex gap-2">
          <a *appHasPermission="'patients:update'" mat-stroked-button routerLink="edit" ><mat-icon>edit</mat-icon> Edit</a>
          <button *appHasPermission="'patients:deactivate'" mat-stroked-button color="warn" [disabled]="p.status === 'INACTIVE'" (click)="deactivate(p)"><mat-icon>person_off</mat-icon> Deactivate</button>
        </div>
      </div>
      <nav mat-tab-nav-bar [tabPanel]="panel" class="mb-4" aria-label="Patient sections">
        @for (t of tabs(); track t.path) { <a mat-tab-link [routerLink]="t.path" routerLinkActive #rla="routerLinkActive" [active]="rla.isActive" [routerLinkActiveOptions]="{ exact: t.path === '.' }">{{ t.label }}</a> }
      </nav>
      <mat-tab-nav-panel #panel><router-outlet /></mat-tab-nav-panel>
    } @else { <p class="p-8 text-center text-slate-500">This patient could not be loaded.</p> }`,
})
export class PatientDetailsComponent implements OnChanges, OnInit, OnDestroy {
  /** Filled by the `patientResolver` (route data) through withComponentInputBinding. */
  @Input() patient: Patient | null = null;
  private readonly ctx = inject(PatientContextService);
  private readonly auth = inject(AuthService);
  private readonly store = inject(Store);
  private readonly confirm = inject(ConfirmService);
  private readonly log = inject(LoggingService);
  private readonly router = inject(Router);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['patient']) { this.ctx.patient.set(this.patient); this.log.debug(`PatientDetails: input changed → patient ${this.patient?.id}`); }
  }
  ngOnInit(): void { this.log.debug('PatientDetails: initialised'); }
  ngOnDestroy(): void { this.log.debug('PatientDetails: destroyed – context released'); }

  protected readonly age = (p: Patient) => ageFromDob(p.dateOfBirth);
  protected readonly avatar = (p: Patient) => avatarUri(`${p.firstName} ${p.lastName}`, 128);
  protected tabs() {
    const r = this.auth.role();
    const all = [
      { path: '.', label: 'Overview', show: true }, { path: 'contact', label: 'Contact', show: this.auth.can('patients:update') },
      { path: 'medical-history', label: 'Medical history', show: this.auth.can('records:read') }, { path: 'appointments', label: 'Appointments', show: this.auth.can('appointments:manage') },
      { path: 'prescriptions', label: 'Prescriptions', show: this.auth.can('prescriptions:read') }, { path: 'lab-reports', label: 'Lab reports', show: this.auth.can('lab:read') },
      { path: 'billing', label: 'Billing', show: this.auth.can('billing:read') },
    ];
    return all.filter((t) => t.show && r);
  }
  protected deactivate(p: Patient): void {
    this.confirm.confirm({ title: 'Deactivate patient?', message: `${p.firstName} ${p.lastName} will no longer be able to book appointments. Existing records are kept.`, confirmLabel: 'Deactivate', destructive: true })
      .subscribe((r) => { if (r.confirmed) { this.store.dispatch(PatientsActions.deactivate({ id: p.id })); void this.router.navigate(['/patients']); } });
  }
}
