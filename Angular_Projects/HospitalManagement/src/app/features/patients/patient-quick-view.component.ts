import { LowerCasePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input, inject } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { signal } from '@angular/core';
import { filter, switchMap } from 'rxjs';
import { PatientApiService } from '../../core/api/patient-api.service';
import { PatientNamePipe } from '../../shared/pipes/pipes';
import { PatientContextService } from './patient-context.service';
import { toLoadState } from '../../shared/utilities/load-state';
import { DataStateComponent } from '../../shared/components';

/**
 * AUXILIARY ROUTE component (named outlet `quick`): `/patients(quick:quick-view/3)` opens this panel next to the list without leaving it.
 * `id` comes from the route parameter through component input binding. `inject(..., { optional: true })` shows an OPTIONAL dependency:
 * the PatientContextService is only provided under the details page, so here it is simply absent (null).
 */
@Component({
  selector: 'app-patient-quick-view',
  standalone: true,
  imports: [RouterLink, LowerCasePipe, PatientNamePipe, DataStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mb-3 flex items-center justify-between"><h2 class="text-sm font-semibold uppercase tracking-wide text-slate-500">Quick view</h2><button type="button" class="text-slate-500 hover:text-slate-900" aria-label="Close quick view" (click)="close()">✕</button></div>
    <app-data-state [state]="state()">
      <ng-template #loaded let-p>
        <div class="space-y-2 text-sm"><div class="text-lg font-bold">{{ p | patientName }}</div><div class="text-slate-500">#{{ p.id }} · {{ p.gender | lowercase }} · {{ p.dateOfBirth }}</div>
          <div>📧 {{ p.email }}</div><div>📞 {{ p.phone }}</div>@if (p.knownAllergies) { <div class="rounded bg-amber-50 p-2 text-amber-900">Allergies: {{ p.knownAllergies }}</div> }
          <a [routerLink]="['/patients', p.id]" class="inline-block pt-2 font-semibold text-brand-600">Open full record →</a>
          <p class="pt-3 text-xs text-slate-400">Context service: {{ ctx ? 'available' : 'not provided here (optional injection)' }}</p></div>
      </ng-template>
    </app-data-state>`,
})
export class PatientQuickViewComponent {
  private readonly api = inject(PatientApiService);
  private readonly router = inject(Router);
  protected readonly ctx = inject(PatientContextService, { optional: true });
  private readonly idSignal = signal(0);
  @Input({ alias: 'id' }) set setId(v: string) { this.idSignal.set(Number(v)); }
  protected readonly state = toSignal(toObservable(this.idSignal).pipe(filter((i) => i > 0), switchMap((i) => toLoadState(this.api.getById(i)))), { initialValue: { status: 'loading' as const } });
  protected close(): void { void this.router.navigate([{ outlets: { quick: null } }]); }
}
