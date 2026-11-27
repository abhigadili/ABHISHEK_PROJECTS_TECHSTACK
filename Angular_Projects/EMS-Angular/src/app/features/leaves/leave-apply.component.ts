import { AsyncPipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, NonNullableFormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { catchError, concatMap, map, of, startWith } from 'rxjs';
import { AppError } from '../../core/models/api.models';
import { DAY_PARTS, DayPart, LeaveRequest } from '../../core/models/leave.models';
import { HasUnsavedChanges } from '../../core/guards/guards';
import { LeaveService } from '../../core/services/leave.service';
import { ReferenceDataService } from '../../core/services/reference-data.service';
import { ToastService } from '../../core/services/toast.service';
import { FileUploadComponent } from '../../shared/components/file-upload.component';
import { PageHeaderComponent } from '../../shared/components/ui-basics';
import { daysBetween, todayIso } from '../../shared/utils/dates';
import { dateRange, errorMessage, futureOrToday } from '../../shared/validators/validators';

/** Cross-field rule: half-day leave is only valid for a single day. */
function halfDayRule(g: AbstractControl): ValidationErrors | null {
  const part = g.get('dayPart')?.value as DayPart;
  const s = g.get('startDate')?.value as string;
  const e = g.get('endDate')?.value as string;
  return part !== 'FULL_DAY' && s && e && s !== e ? { halfDayRange: true } : null;
}

/**
 * Leave application (typed reactive form). Frontend rules are guidance — the backend validates entitlement,
 * overlaps, max consecutive days and half-day policy and its message is shown inline when it refuses.
 */
@Component({
  selector: 'app-leave-apply',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, AsyncPipe, DecimalPipe, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule, MatSelectModule, PageHeaderComponent, FileUploadComponent],
  template: `
    <div class="page narrow">
      <app-page-header title="Apply for leave" subtitle="Your manager is notified when you submit" />
      @if (error(); as e) {
        <div class="server-error" role="alert" data-testid="leave-error">{{ e.message }}</div>
      }
      <form class="panel" [formGroup]="form" (ngSubmit)="submit()" novalidate data-testid="leave-form">
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Leave type</mat-label>
          <mat-select formControlName="leaveTypeId" data-testid="leave-type">
            @for (t of types$ | async; track t.id) {
              <mat-option [value]="t.id">{{ t.name }}</mat-option>
            }
          </mat-select>
          <mat-error>{{ err('leaveTypeId', 'Leave type') }}</mat-error>
        </mat-form-field>

        @if (balance(); as b) {
          <p class="balance" data-testid="leave-balance-hint"><mat-icon>account_balance_wallet</mat-icon> Available: <strong>{{ b.available | number: '1.0-1' }}</strong> of {{ b.entitled + b.adjusted | number: '1.0-1' }} days</p>
        }

        <div class="form-grid">
          <mat-form-field appearance="outline">
            <mat-label>Start date</mat-label>
            <input matInput type="date" formControlName="startDate" [min]="today" data-testid="leave-start" />
            <mat-error>{{ err('startDate', 'Start date') }}</mat-error>
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>End date</mat-label>
            <input matInput type="date" formControlName="endDate" [min]="form.controls.startDate.value || today" data-testid="leave-end" />
            <mat-error>{{ err('endDate', 'End date') }}</mat-error>
          </mat-form-field>
        </div>
        @if (form.hasError('dateRange') && form.touched) {
          <p class="form-err" role="alert">End date cannot be before the start date.</p>
        }
        @if (calendarDays(); as n) {
          <p class="muted">Spans {{ n }} calendar day{{ n === 1 ? '' : 's' }} (the server counts working days only).</p>
        }

        @if (halfDayAllowed()) {
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Day part</mat-label>
            <mat-select formControlName="dayPart">
              @for (p of dayParts; track p) {
                <mat-option [value]="p">{{ p.replace('_', ' ') }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
          @if (form.hasError('halfDayRange')) {
            <p class="form-err" role="alert">Half-day leave must start and end on the same day.</p>
          }
        }

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Reason</mat-label>
          <textarea matInput rows="3" formControlName="reason" maxlength="1000" data-testid="leave-reason"></textarea>
          <mat-error>{{ err('reason', 'Reason') }}</mat-error>
        </mat-form-field>

        @if (selectedType()?.requiresDocument) {
          <div class="doc">
            <app-file-upload label="Attach supporting document" icon="attach_file" [accept]="docTypes" (fileSelected)="doc.set($event)" />
            @if (doc(); as d) { <span>{{ d.name }}</span> } @else { <span class="form-err">A document is required for this leave type.</span> }
          </div>
        }

        <div class="actions">
          <a mat-button routerLink="/leaves">Cancel</a>
          <button mat-flat-button color="primary" type="submit" [disabled]="saving()" data-testid="leave-submit">Submit request</button>
        </div>
      </form>
    </div>
  `,
  styles: `
    .narrow { max-width: 680px; }
    .balance { display: flex; align-items: center; gap: 8px; background: #e8f0fe; padding: 8px 12px; border-radius: 8px; margin: 0 0 12px; }
    .doc { display: flex; gap: 12px; align-items: center; margin-bottom: 12px; flex-wrap: wrap; }
    .form-err { color: #b3261e; font-size: 13px; margin: 0 0 8px; }
    .server-error { background: #fce8e6; color: #c5221f; padding: 10px 14px; border-radius: 8px; margin-bottom: 12px; }
    .actions { display: flex; justify-content: flex-end; gap: 8px; }
  `,
})
export class LeaveApplyComponent implements HasUnsavedChanges {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly svc = inject(LeaveService);
  private readonly reference = inject(ReferenceDataService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  protected readonly today = todayIso();
  protected readonly dayParts = DAY_PARTS;
  protected readonly docTypes = ['image/jpeg', 'image/png', 'application/pdf'];
  protected readonly types$ = this.reference.leaveTypes(); // consumed with the async pipe
  private readonly types = toSignal(this.types$, { initialValue: [] });
  private readonly balances = toSignal(this.svc.myBalances().pipe(map((b) => b.balances), catchError(() => of([]))), { initialValue: [] });

  protected readonly saving = signal(false);
  protected readonly error = signal<AppError | null>(null);
  protected readonly doc = signal<File | null>(null);
  private submitted = false;

  protected readonly form = this.fb.group(
    {
      leaveTypeId: this.fb.control<number | null>(null, Validators.required),
      startDate: ['', [Validators.required, futureOrToday()]],
      endDate: ['', [Validators.required, futureOrToday()]],
      dayPart: this.fb.control<DayPart>('FULL_DAY'),
      reason: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(1000)]],
    },
    { validators: [dateRange('startDate', 'endDate'), halfDayRule] },
  );

  private readonly value = toSignal(this.form.valueChanges.pipe(startWith(this.form.getRawValue()), map(() => this.form.getRawValue())), { initialValue: this.form.getRawValue() });
  protected readonly selectedType = computed(() => this.types().find((t) => t.id === this.value().leaveTypeId) ?? null);
  protected readonly balance = computed(() => this.balances().find((b) => b.leaveTypeId === this.value().leaveTypeId) ?? null);
  protected readonly halfDayAllowed = computed(() => !!this.selectedType()?.policy?.allowHalfDay);
  protected readonly calendarDays = computed(() => {
    const v = this.value();
    return v.startDate && v.endDate && v.endDate >= v.startDate ? daysBetween(v.startDate, v.endDate) : null;
  });
  protected readonly err = (n: 'leaveTypeId' | 'startDate' | 'endDate' | 'reason', l: string) => errorMessage(this.form.controls[n], l);

  hasUnsavedChanges(): boolean {
    return this.form.dirty && !this.submitted;
  }

  protected submit(): void {
    this.form.markAllAsTouched();
    this.error.set(null);
    if (this.form.invalid || this.saving()) return;
    if (this.selectedType()?.requiresDocument && !this.doc()) return;
    const v = this.form.getRawValue();
    this.saving.set(true);
    this.svc
      .apply({ leaveTypeId: v.leaveTypeId!, startDate: v.startDate, endDate: v.endDate, dayPart: this.halfDayAllowed() ? v.dayPart : 'FULL_DAY', reason: v.reason.trim() })
      .pipe(
        // second step only after the request exists: attach the document, then continue with the created request
        concatMap((created: LeaveRequest) => (this.doc() ? this.svc.uploadDocument(created.id, this.doc()!).pipe(map(() => created)) : of(created))),
      )
      .subscribe({
        next: (created) => {
          this.submitted = true;
          this.toast.success('Leave request submitted');
          void this.router.navigate(['/leaves', created.id]);
        },
        error: (e: AppError) => {
          this.saving.set(false);
          this.error.set(e);
        },
      });
  }
}
