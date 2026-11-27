import { NgClass, NgComponentOutlet, NgFor, NgIf, NgStyle, NgSwitch, NgSwitchCase, NgSwitchDefault, NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input, Type, ViewEncapsulation } from '@angular/core';
import type { Department } from '../../core/models';

/** Small standalone badge rendered dynamically with NgComponentOutlet. */
@Component({ selector: 'app-facility-badge', standalone: true, changeDetection: ChangeDetectionStrategy.OnPush, template: `<span class="badge text-bg-info">{{ label }}</span>` })
export class FacilityBadgeComponent { label = 'On-site unit'; }
@Component({ selector: 'app-support-badge', standalone: true, changeDetection: ChangeDetectionStrategy.OnPush, template: `<span class="badge text-bg-secondary">Support service</span>` })
export class SupportBadgeComponent {}

/**
 * ISOLATED example of the TRADITIONAL built-in directives (the rest of the application uses the new control flow):
 *   *ngIf (+else)  *ngFor (+trackBy)  [ngSwitch]  [ngClass]  [ngStyle]  *ngTemplateOutlet  *ngComponentOutlet
 * The hospital "Facilities" tab renders the departments of a hospital as facility tiles with them.
 */
@Component({
  selector: 'app-legacy-facility-panel',
  standalone: true,
  imports: [NgIf, NgFor, NgSwitch, NgSwitchCase, NgSwitchDefault, NgClass, NgStyle, NgTemplateOutlet, NgComponentOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // ViewEncapsulation.None: these styles are global on purpose so they can restyle the Bootstrap classes inside the tiles (default is Emulated)
  encapsulation: ViewEncapsulation.None,
  styles: ['.facility-panel .card-title { letter-spacing: .02em; } .facility-panel .card { transition: box-shadow .15s; } .facility-panel .card:hover { box-shadow: 0 .25rem .75rem rgba(0,0,0,.12); }'],
  template: `
    <div *ngIf="departments.length > 0; else none" class="row g-3 facility-panel">
      <div class="col-12 col-md-6 col-xl-4" *ngFor="let d of departments; trackBy: trackById; let i = index; let odd = odd">
        <ng-container *ngTemplateOutlet="tile; context: { $implicit: d, index: i, zebra: odd }"></ng-container>
      </div>
    </div>
    <ng-template #none><p class="text-muted">No departments are recorded for this hospital.</p></ng-template>
    <ng-template #tile let-d let-index="index" let-zebra="zebra">
      <div class="card h-100" [ngClass]="{ 'border-success': d.active, 'border-secondary': !d.active, 'bg-body-tertiary': zebra }" [ngStyle]="{ opacity: d.active ? 1 : 0.6 }">
        <div class="card-body">
          <div class="d-flex justify-content-between"><h3 class="h6 mb-1">{{ index + 1 }}. {{ d.name }}</h3>
            <ng-container [ngSwitch]="kind(d)"><span *ngSwitchCase="'clinical'" class="badge text-bg-primary">Clinical</span><span *ngSwitchCase="'diagnostic'" class="badge text-bg-warning">Diagnostic</span><span *ngSwitchDefault class="badge text-bg-light">General</span></ng-container></div>
          <p class="card-text small text-muted mb-2">{{ d.description || 'Operating unit' }}</p>
          <ng-container *ngComponentOutlet="badgeFor(d)"></ng-container>
        </div>
      </div>
    </ng-template>`,
})
export class LegacyFacilityPanelComponent {
  @Input() departments: readonly Department[] = [];
  protected readonly trackById = (_: number, d: Department) => d.id;
  protected kind(d: Department): 'clinical' | 'diagnostic' | 'other' { return /laborat|radio|patholog/i.test(d.name) ? 'diagnostic' : /cardio|ortho|pediat|medicine|surg|neuro/i.test(d.name) ? 'clinical' : 'other'; }
  protected badgeFor(d: Department): Type<unknown> { return /pharmac|laborat|radio/i.test(d.name) ? FacilityBadgeComponent : SupportBadgeComponent; }
}
