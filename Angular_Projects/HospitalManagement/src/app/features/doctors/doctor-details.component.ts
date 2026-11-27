import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input, OnChanges, inject, signal, SimpleChanges } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Store } from '@ngrx/store';
import { AuthService } from '../../core/auth/auth.service';
import type { Doctor } from '../../core/models';
import { CurrentIdentityService } from '../../core/services/current-identity.service';
import { toSignal } from '@angular/core/rxjs-interop';
import * as A from '../../state/actions/doctors.actions';
import { ConfirmService } from '../../shared/components';
import { HasPermissionDirective } from '../../shared/directives/directives';
import { SpecializationPipe } from '../../shared/pipes/pipes';
import { avatarUri } from '../../shared/utilities/helpers';
import { DoctorContext } from './doctor-context';

/** Doctor details layout: header + routed tabs. The resolved doctor arrives as @Input (route resolver) and is published through DoctorContext. */
@Component({
  selector: 'app-doctor-details',
  standalone: true,
  imports: [CurrencyPipe, RouterOutlet, RouterLink, RouterLinkActive, MatTabsModule, MatButtonModule, MatIconModule, HasPermissionDirective, SpecializationPipe],
  providers: [DoctorContext],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (doctor; as d) {
      <div class="mb-4 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
        <div class="flex items-center gap-4"><img [src]="avatar(d)" alt="" width="72" height="72" loading="lazy" class="rounded-full" />
          <div><h1 class="text-2xl font-bold">{{ d.fullName }}</h1><p class="font-semibold text-brand-600">{{ d.specialization | specialization }}</p>
            <p class="text-sm text-slate-500">{{ d.qualification ?? 'Qualification n/a' }} · {{ d.experienceYears ?? '—' }} years · {{ d.consultationFee | currency: 'INR' }} per visit · Licence {{ d.licenseNumber }}</p></div></div>
        <div class="flex flex-wrap gap-2">
          @if (d.active && (auth.role() === 'ADMIN' || auth.role() === 'PATIENT')) { <a mat-flat-button color="primary" [routerLink]="['/appointments/book']" [queryParams]="{ doctorId: d.id }"><mat-icon>event_available</mat-icon> Book appointment</a> }
          <a *appHasPermission="'doctors:manage'" mat-stroked-button routerLink="edit"><mat-icon>edit</mat-icon> Edit</a>
          <button *appHasPermission="'doctors:manage'" mat-stroked-button color="warn" [disabled]="!d.active" (click)="deactivate(d)">Deactivate</button>
        </div>
      </div>
      <nav mat-tab-nav-bar [tabPanel]="panel" class="mb-4" aria-label="Doctor sections">
        @for (t of tabs(); track t.path) { <a mat-tab-link [routerLink]="t.path" routerLinkActive #r="routerLinkActive" [active]="r.isActive" [routerLinkActiveOptions]="{ exact: t.path === '.' }">{{ t.label }}</a> }
      </nav>
      <mat-tab-nav-panel #panel><router-outlet /></mat-tab-nav-panel>
    } @else { <p class="p-8 text-center text-slate-500">This doctor could not be loaded.</p> }`,
})
export class DoctorDetailsComponent implements OnChanges {
  @Input() doctor: Doctor | null = null;
  protected readonly auth = inject(AuthService);
  private readonly ctx = inject(DoctorContext);
  private readonly store = inject(Store);
  private readonly confirm = inject(ConfirmService);
  private readonly router = inject(Router);
  private readonly own = toSignal(inject(CurrentIdentityService).doctor$);
  protected readonly isOwn = signal(false);

  ngOnChanges(c: SimpleChanges): void {
    if (c['doctor'] && this.doctor) {
      this.ctx.doctor.set(this.doctor);
      this.store.dispatch(A.loadDoctorSuccess({ doctor: this.doctor })); // upsertOne: keep the entity collection fresh with the resolver's result
    }
  }
  protected avatar(d: Doctor) { return avatarUri(d.fullName, 144); }
  protected tabs() {
    const showAppts = this.auth.role() === 'ADMIN' || this.auth.role() === 'DOCTOR';
    return [{ path: '.', label: 'Profile' }, { path: 'schedule', label: 'Weekly schedule' }, { path: 'availability', label: 'Availability' }, ...(showAppts ? [{ path: 'appointments', label: 'Appointments' }] : [])];
  }
  protected deactivate(d: Doctor) {
    this.confirm.confirm({ title: 'Deactivate doctor?', message: `${d.fullName} will no longer appear for new bookings.`, confirmLabel: 'Deactivate', destructive: true }).subscribe((r) => {
      if (r.confirmed) { this.store.dispatch(A.deactivateDoctor({ id: d.id })); void this.router.navigate(['/doctors']); }
    });
  }
  /** Can the signed-in user manage this doctor's schedule? ADMIN, or the doctor themself. */
  canManageSchedule(): boolean { return this.auth.role() === 'ADMIN' || (this.auth.role() === 'DOCTOR' && this.own()?.id === this.doctor?.id); }
}
