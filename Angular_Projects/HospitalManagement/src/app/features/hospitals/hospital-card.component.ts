import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { Hospital } from '../../core/models';
import { CARD_DENSITY, HospitalContextService, CardExpansionState } from './hospital-context.service';

/** Inner element: reaches the CARD's state with { host: true } (resolved at the host element, not further up). */
@Component({
  selector: 'app-hospital-card-details',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="small text-muted mt-2" [attr.data-density]="density">@if (hospital().email) { <div>✉ {{ hospital().email }}</div> }<div>Code <b>{{ hospital().code }}</b> · {{ hospital().active ? 'active' : 'inactive' }}</div><div>Open: {{ open() ? 'expanded' : 'collapsed' }} (host-scoped state)</div></div>`,
})
export class HospitalCardDetailsComponent {
  readonly hospital = input.required<Hospital>();
  private readonly state = inject(CardExpansionState, { host: true });
  protected readonly density = inject(CARD_DENSITY, { optional: true }) ?? 'comfortable'; // from the card's viewProviders
  protected readonly open = () => this.state.expandedId() === this.hospital().id;
}

/**
 * Bootstrap card. `viewProviders: [CardExpansionState]` creates a card-level instance; the list's instance (one level up) is reached with
 * `skipSelf` so opening one card collapses the others – self / skipSelf / host / optional in one realistic component.
 */
@Component({
  selector: 'app-hospital-card',
  standalone: true,
  imports: [RouterLink, HospitalCardDetailsComponent],
  // viewProviders (not providers): `inject(..., { host: true })` in the card's inner component only sees the host's viewProviders
  viewProviders: [CardExpansionState, { provide: CARD_DENSITY, useValue: 'compact' as const }],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="card h-100" [class.border-primary]="active()">
      <div class="card-body">
        <div class="d-flex justify-content-between align-items-start"><h2 class="h5 card-title mb-1">{{ hospital().name }}</h2>@if (active()) { <span class="badge text-bg-primary">Working here</span> }@if (!hospital().active) { <span class="badge text-bg-secondary">Inactive</span> }</div>
        <p class="card-text text-muted mb-1">📍 {{ hospital().address || 'Address not recorded' }}{{ hospital().city ? ', ' + hospital().city : '' }}</p>
        <p class="card-text text-muted mb-2">📞 {{ hospital().phone || '—' }}</p>
        @if (open()) { <app-hospital-card-details [hospital]="hospital()" /> }
      </div>
      <div class="card-footer bg-transparent d-flex flex-wrap gap-2">
        <a class="btn btn-sm btn-primary" [routerLink]="[hospital().id]">Details</a>
        <button type="button" class="btn btn-sm btn-outline-secondary" (click)="toggle()" [attr.aria-expanded]="open()">{{ open() ? 'Less' : 'More' }}</button>
        @if (hospital().active && !active()) { <button type="button" class="btn btn-sm btn-outline-primary" (click)="context.set(hospital().id)">Set as active</button> }
      </div>
    </div>`,
})
export class HospitalCardComponent {
  readonly hospital = input.required<Hospital>();
  protected readonly context = inject(HospitalContextService);
  private readonly own = inject(CardExpansionState, { self: true });
  private readonly list = inject(CardExpansionState, { skipSelf: true, optional: true });
  protected readonly active = () => this.context.activeId() === this.hospital().id;
  protected readonly open = () => (this.list ? this.list.expandedId() === this.hospital().id : this.own.expandedId() === this.hospital().id);
  protected toggle() { this.own.toggle(this.hospital().id); this.list?.toggle(this.hospital().id); }
}
