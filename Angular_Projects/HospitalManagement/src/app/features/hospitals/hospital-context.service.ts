import { InjectionToken, Injectable, computed, inject, signal } from '@angular/core';
import { Store } from '@ngrx/store';
import { APP_CONFIG } from '../../core/configuration/app-config';
import { HospitalsActions } from '../../state/actions/hospitals.actions';
import { selectActiveHospital } from '../../state/selectors/hospitals.selectors';

/** Route-level token (overridden through `providers` in hospitals.routes.ts with a factory that depends on APP_CONFIG). */
export const HOSPITAL_PAGE_SIZE = new InjectionToken<number>('HOSPITAL_PAGE_SIZE', { providedIn: 'root', factory: () => 6 });

/** SINGLETON (providedIn: 'root') service: the hospital the signed-in staff member works in; state in NgRx, persisted in localStorage. */
@Injectable({ providedIn: 'root' })
export class HospitalContextService {
  private readonly store = inject(Store);
  private static readonly KEY = 'hms.ng.activeHospital';
  readonly active = this.store.selectSignal(selectActiveHospital);
  readonly activeId = computed(() => this.active()?.id ?? null);
  constructor() {
    try { const id = Number(localStorage.getItem(HospitalContextService.KEY)); if (id) this.store.dispatch(HospitalsActions.activeHospitalSet({ id })); } catch { /* ignore */ }
  }
  set(id: number | null): void {
    this.store.dispatch(HospitalsActions.activeHospitalSet({ id }));
    try { id ? localStorage.setItem(HospitalContextService.KEY, String(id)) : localStorage.removeItem(HospitalContextService.KEY); } catch { /* ignore */ }
  }
}

/**
 * Hierarchical DI: an element-injector service provided BOTH by the list (outer) and by every card (inner).
 * A card injects its own instance (`self`), reaches the list's instance with `skipSelf` (optional – a card can also be used alone)
 * and its content child injects the card's instance with `host`.
 */
@Injectable()
export class CardExpansionState {
  readonly expandedId = signal<number | null>(null);
  readonly isOpen = (id: number) => computed(() => this.expandedId() === id);
  toggle(id: number) { this.expandedId.update((cur) => (cur === id ? null : id)); }
}
export const pageSizeFactory = () => (inject(APP_CONFIG).production ? 12 : 6);

/** Visual density of hospital cards. Provided with `viewProviders` on the card: visible to the card's own VIEW children, NOT to projected content. */
export const CARD_DENSITY = new InjectionToken<'compact' | 'comfortable'>('CARD_DENSITY');
