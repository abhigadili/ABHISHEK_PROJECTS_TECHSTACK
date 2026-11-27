import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { RouterLink } from '@angular/router';
import { BehaviorSubject, EMPTY, catchError, distinctUntilChanged, map, switchMap, timer } from 'rxjs';
import { PrescriptionApiService } from '../../core/api/prescription-api.service';
import { AuthService } from '../../core/auth/auth.service';
import type { LoadState } from '../../core/models/api-error';
import type { Prescription } from '../../core/models';
import { ConfirmService } from '../../shared/components/confirm-dialog.component';
import { DataStateComponent, PageHeaderComponent } from '../../shared/components';
import { NotificationService } from '../../core/services/notification.service';
import { toLoadState } from '../../shared/utilities/load-state';
import { PrescriptionViewComponent } from './prescription-view.component';
import { PrescriptionService } from './prescription.service';

/** Prescription details: resolved id via route input binding, live status polled every 10 s (timer + switchMap + takeUntilDestroyed). */
@Component({
  selector: 'app-prescription-details',
  standalone: true,
  imports: [RouterLink, MatButtonModule, PageHeaderComponent, DataStateComponent, PrescriptionViewComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mx-auto max-w-3xl">
      <app-page-header title="Prescription" [subtitle]="'#' + id()"><a actions mat-button routerLink="/prescriptions">Back</a></app-page-header>
      <app-data-state [state]="state()" (retry)="reload$.next()">
        <ng-template #loaded let-p>
          <app-prescription-view [prescription]="p" [status]="liveStatus()">
            <ng-container actions>
              <button mat-stroked-button type="button" (click)="svc.print(p)">Print</button>
              <button mat-stroked-button type="button" (click)="svc.download(p)">Download</button>
              @if (auth.can('pharmacy:read')) { <a mat-stroked-button routerLink="/pharmacy/orders">Pharmacy orders</a> }
              @if (canCancel(p)) { <button mat-button color="warn" type="button" (click)="cancel(p)" [disabled]="busy()">Cancel prescription</button> }
            </ng-container>
          </app-prescription-view>
        </ng-template>
      </app-data-state>
    </div>`,
})
export class PrescriptionDetailsComponent {
  readonly id = input.required<string>();
  protected readonly auth = inject(AuthService);
  protected readonly svc = inject(PrescriptionService);
  private readonly api = inject(PrescriptionApiService);
  private readonly confirm = inject(ConfirmService);
  private readonly notify = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly reload$ = new BehaviorSubject<void>(undefined);
  protected readonly busy = signal(false);
  private readonly id$ = toObservable(computed(() => Number(this.id())));
  protected readonly state = toSignal(this.reload$.pipe(switchMap(() => this.id$), switchMap((id) => toLoadState(this.api.getById(id)))), { initialValue: { status: 'loading' } as LoadState<Prescription> });
  protected readonly liveStatus = toSignal(this.id$.pipe(switchMap((id) => timer(0, 10_000).pipe(switchMap(() => this.api.status(id).pipe(catchError(() => EMPTY))))), map((s) => s.status), distinctUntilChanged()), { initialValue: null });
  protected canCancel(p: Prescription) { return (this.liveStatus() ?? p.status) === 'ACTIVE' && this.auth.can('prescriptions:create'); }
  protected cancel(p: Prescription) {
    this.confirm.confirm({ title: 'Cancel prescription?', message: `Prescription #${p.id} will be cancelled and can no longer be dispensed.`, confirmLabel: 'Cancel prescription', destructive: true }).pipe(
      switchMap((r) => { if (!r.confirmed) return EMPTY; this.busy.set(true); return this.api.cancel(p.id); }), takeUntilDestroyed(this.destroyRef),
    ).subscribe({ next: () => { this.busy.set(false); this.notify.success('Prescription cancelled'); this.reload$.next(); }, error: () => this.busy.set(false) });
  }
}
