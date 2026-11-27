import { Injectable, computed, inject, signal } from '@angular/core';
import { AuthService } from '../../core/auth/auth.service';
import { CurrentIdentityService } from '../../core/services/current-identity.service';
import { toSignal } from '@angular/core/rxjs-interop';
import type { Doctor } from '../../core/models';

/** Component-level provider for the doctor details subtree (see DoctorDetailsComponent.providers). */
@Injectable()
export class DoctorContext {
  private readonly auth = inject(AuthService);
  private readonly own = toSignal(inject(CurrentIdentityService).doctor$);
  readonly doctor = signal<Doctor | null>(null);
  readonly id = computed(() => this.doctor()?.id ?? 0);
  readonly canManageSchedule = computed(() => this.auth.role() === 'ADMIN' || (this.auth.role() === 'DOCTOR' && this.own()?.id === this.id()));
}
