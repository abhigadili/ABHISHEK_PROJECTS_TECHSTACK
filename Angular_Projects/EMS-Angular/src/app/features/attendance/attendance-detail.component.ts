import { DatePipe, TitleCasePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { catchError, of, switchMap, tap } from 'rxjs';
import { AttendanceService } from '../../core/services/attendance.service';
import { ToastService } from '../../core/services/toast.service';
import { EmptyStateComponent, PageHeaderComponent, StatusBadgeComponent } from '../../shared/components/ui-basics';
import { HasPermissionDirective } from '../../shared/directives/directives';
import { ServerDateTimePipe, WorkingHoursPipe } from '../../shared/pipes/pipes';
import { AttendanceEditDialogComponent } from './attendance-edit-dialog.component';

/** `id` comes from the route param through input binding (withComponentInputBinding). */
@Component({
  selector: 'app-attendance-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TitleCasePipe, RouterLink, DatePipe, MatButtonModule, MatCardModule, MatIconModule, PageHeaderComponent, StatusBadgeComponent, EmptyStateComponent, HasPermissionDirective, ServerDateTimePipe, WorkingHoursPipe],
  template: `
    <div class="page narrow">
      @if (record(); as r) {
        <app-page-header [title]="'Attendance · ' + (r.workDate | date: 'fullDate')" [subtitle]="r.employeeName + ' (' + r.employeeCode + ')'">
          <a pageActions mat-stroked-button routerLink="/attendance"><mat-icon>arrow_back</mat-icon> Back</a>
          <button pageActions mat-flat-button type="button" (click)="correct()" *appHasPermission="'attendance.correct'" data-testid="correct-attendance"><mat-icon>edit</mat-icon> Correct</button>
        </app-page-header>
        <mat-card appearance="outlined">
          <mat-card-content>
            <dl>
              <dt>Status</dt><dd><app-status-badge [value]="r.status" [label]="r.status.replace('_', ' ') | titlecase" /></dd>
              <dt>Department</dt><dd>{{ r.department?.name ?? '—' }}</dd>
              <dt>Check-in</dt><dd>{{ r.checkInAt | serverDateTime }}</dd>
              <dt>Check-out</dt><dd>{{ r.checkOutAt | serverDateTime }}</dd>
              <dt>Working hours</dt><dd>{{ r.workingHours | workingHours }}</dd>
              <dt>Work mode</dt><dd>{{ r.workMode ?? '—' }}</dd>
              <dt>Remarks</dt><dd>{{ r.remarks ?? '—' }}</dd>
              @if (r.correction) {
                <dt>Correction</dt><dd data-testid="correction-note">{{ r.correction.reason ?? 'Corrected' }}</dd>
              }
            </dl>
          </mat-card-content>
        </mat-card>
      } @else if (missing()) {
        <app-empty-state icon="event_busy" title="Record not found" message="It may not exist or you may not have access."><a mat-stroked-button routerLink="/attendance">Back to attendance</a></app-empty-state>
      }
    </div>
  `,
  styles: `
    .narrow { max-width: 760px; }
    dl { display: grid; grid-template-columns: 160px 1fr; gap: 10px 16px; margin: 0; }
    dt { color: var(--ems-muted); }
    dd { margin: 0; }
  `,
})
export class AttendanceDetailComponent {
  private readonly svc = inject(AttendanceService);
  private readonly dialog = inject(MatDialog);
  private readonly toast = inject(ToastService);

  readonly id = input.required<string>();
  private readonly version = signal(0);
  protected readonly missing = signal(false);

  /** Re-fetches when the id changes (navigation) or after a correction (version bump); switchMap drops stale responses. */
  protected readonly record = toSignal(
    toObservable(computed(() => ({ id: Number(this.id()), v: this.version() }))).pipe(
      switchMap(({ id }) =>
        this.svc.get(id).pipe(
          tap(() => this.missing.set(false)),
          catchError(() => {
            this.missing.set(true);
            return of(null);
          }),
        ),
      ),
    ),
    { initialValue: null },
  );

  protected correct(): void {
    const record = this.record();
    if (!record) return;
    this.dialog.open(AttendanceEditDialogComponent, { data: { record }, maxWidth: '95vw' }).afterClosed().subscribe((ok) => {
      if (ok) {
        this.toast.success('Attendance corrected');
        this.version.update((v) => v + 1);
      }
    });
  }
}
