import { Injectable, computed, signal } from '@angular/core';
import type { Patient } from '../../core/models';

/**
 * COMPONENT-LEVEL provider (element injector): declared in `PatientDetailsComponent.providers`, so every open patient page gets its
 * own instance and the tab components below it share it. Outside that subtree (e.g. the quick-view panel) it is NOT available –
 * those consumers inject it with `{ optional: true }`.
 */
@Injectable()
export class PatientContextService {
  readonly patient = signal<Patient | null>(null);
  readonly id = computed(() => this.patient()?.id ?? 0);
  readonly fullName = computed(() => { const p = this.patient(); return p ? `${p.firstName} ${p.lastName}` : ''; });
}
