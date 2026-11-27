import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, FormBuilder, NonNullableFormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTabsModule } from '@angular/material/tabs';
import { catchError, debounceTime, map, of, startWith, switchMap } from 'rxjs';
import { AppError, PageMeta } from '../../core/models/api.models';
import { LEAVE_STATUSES, LeaveRequest, LeaveStatus, LeaveType } from '../../core/models/leave.models';
import { LeaveService } from '../../core/services/leave.service';
import { ReferenceDataService } from '../../core/services/reference-data.service';
import { ToastService } from '../../core/services/toast.service';
import { CellDirective, DataTableComponent, TableColumn } from '../../shared/components/data-table.component';
import { DialogFrameComponent } from '../../shared/components/dialogs';
import { EmployeeSelectComponent } from '../../shared/components/employee-select.component';
import { ErrorMessageComponent, PageHeaderComponent, StatusBadgeComponent } from '../../shared/components/ui-basics';
import { NumbersOnlyDirective } from '../../shared/directives/directives';
import { LeaveStatusPipe } from '../../shared/pipes/pipes';
import { parseIsoDate } from '../../shared/utils/dates';
import { dateRange, errorMessage } from '../../shared/validators/validators';

const nonZero = (c: AbstractControl): ValidationErrors | null => (Number(c.value) === 0 ? { nonZero: true } : null);

/** Create / edit a leave type (with its policy). */
@Component({
  selector: 'app-leave-type-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, MatDialogModule, MatButtonModule, MatCheckboxModule, MatFormFieldModule, MatInputModule, DialogFrameComponent],
  template: `
    <app-dialog-frame [title]="data ? 'Edit leave type' : 'New leave type'">
      <form [formGroup]="form" id="leave-type-form" (ngSubmit)="save()" novalidate>
        @if (error(); as e) { <p class="err" role="alert">{{ e.message }}</p> }
        @if (!data) {
          <mat-form-field appearance="outline" class="full"><mat-label>Code</mat-label><input matInput formControlName="code" (input)="upper()" /><mat-hint>A–Z, 0–9, _</mat-hint><mat-error>{{ err('code', 'Code') }}</mat-error></mat-form-field>
        }
        <mat-form-field appearance="outline" class="full"><mat-label>Name</mat-label><input matInput formControlName="name" /><mat-error>{{ err('name', 'Name') }}</mat-error></mat-form-field>
        <mat-form-field appearance="outline" class="full"><mat-label>Description</mat-label><input matInput formControlName="description" /></mat-form-field>
        <div formGroupName="policy">
          <mat-form-field appearance="outline" class="full"><mat-label>Annual entitlement (days)</mat-label><input matInput type="number" formControlName="annualEntitlement" /><mat-error>{{ err('policy.annualEntitlement', 'Entitlement') }}</mat-error></mat-form-field>
          <mat-form-field appearance="outline" class="full"><mat-label>Carry-forward max (days)</mat-label><input matInput type="number" formControlName="carryForwardMax" /></mat-form-field>
          <mat-form-field appearance="outline" class="full"><mat-label>Max consecutive days (blank = unlimited)</mat-label><input matInput type="number" formControlName="maxConsecutiveDays" /></mat-form-field>
          <mat-checkbox formControlName="allowHalfDay">Allow half-day</mat-checkbox>
        </div>
        <div class="checks">
          <mat-checkbox formControlName="isPaid">Paid</mat-checkbox>
          <mat-checkbox formControlName="requiresDocument">Requires document</mat-checkbox>
          @if (data) { <mat-checkbox formControlName="isActive">Active</mat-checkbox> }
        </div>
      </form>
      <button dialogActions mat-button type="button" mat-dialog-close>Cancel</button>
      <button dialogActions mat-flat-button color="primary" type="submit" form="leave-type-form" [disabled]="busy()">Save</button>
    </app-dialog-frame>
  `,
  styles: `.full { width: 100%; min-width: min(380px, 80vw); } .err { color: #c5221f; } .checks { display: flex; gap: 16px; flex-wrap: wrap; margin-top: 4px; }`,
})
export class LeaveTypeDialogComponent {
  protected readonly data = inject<LeaveType | null>(MAT_DIALOG_DATA);
  private readonly ref = inject<MatDialogRef<LeaveTypeDialogComponent, boolean>>(MatDialogRef);
  private readonly svc = inject(LeaveService);
  private readonly fb = inject(FormBuilder);
  protected readonly busy = signal(false);
  protected readonly error = signal<AppError | null>(null);

  protected readonly form = this.fb.group({
    code: [this.data?.code ?? '', this.data ? [] : [Validators.required, Validators.pattern(/^[A-Z0-9_]{1,20}$/)]],
    name: [this.data?.name ?? '', [Validators.required, Validators.maxLength(80)]],
    description: [this.data?.description ?? ''],
    isPaid: [this.data?.isPaid ?? true],
    requiresDocument: [this.data?.requiresDocument ?? false],
    isActive: [this.data?.isActive ?? true],
    policy: this.fb.group({
      annualEntitlement: [this.data?.policy?.annualEntitlement ?? 12, [Validators.required, Validators.min(0), Validators.max(366)]],
      carryForwardMax: [this.data?.policy?.carryForwardMax ?? 0, [Validators.min(0), Validators.max(366)]],
      maxConsecutiveDays: this.fb.control<number | null>(this.data?.policy?.maxConsecutiveDays ?? null, [Validators.min(1), Validators.max(366)]),
      allowHalfDay: [this.data?.policy?.allowHalfDay ?? true],
    }),
  });
  protected readonly err = (p: string, l: string) => errorMessage(this.form.get(p), l);

  protected upper(): void {
    const c = this.form.controls.code;
    if (c.value) c.setValue(c.value.toUpperCase());
  }

  protected save(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.busy()) return;
    const v = this.form.getRawValue();
    const policy = { annualEntitlement: v.policy.annualEntitlement ?? 0, carryForwardMax: v.policy.carryForwardMax ?? 0, allowHalfDay: !!v.policy.allowHalfDay, maxConsecutiveDays: v.policy.maxConsecutiveDays ?? null };
    const common = { name: v.name!.trim(), description: v.description?.trim() || null, isPaid: !!v.isPaid, requiresDocument: !!v.requiresDocument, policy };
    this.busy.set(true);
    (this.data ? this.svc.updateType(this.data.id, { ...common, isActive: !!v.isActive }) : this.svc.createType({ ...common, code: v.code! })).subscribe({
      next: () => this.ref.close(true),
      error: (e: AppError) => { this.error.set(e); this.busy.set(false); },
    });
  }
}

interface Result { items: LeaveRequest[]; meta: PageMeta | null; error: AppError | null }

/** HR leave administration: all requests, balance adjustments (audited) and leave-type management. */
@Component({
  selector: 'app-leave-admin',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule, DatePipe, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule, MatSelectModule, MatTabsModule, DataTableComponent, CellDirective,
    EmployeeSelectComponent, PageHeaderComponent, StatusBadgeComponent, ErrorMessageComponent, LeaveStatusPipe, NumbersOnlyDirective,
  ],
  template: `
    <div class="page">
      <app-page-header title="Leave administration" subtitle="All requests, balance adjustments and leave policies" />
      <mat-tab-group animationDuration="0">
        <mat-tab label="All requests">
          <div class="panel tab">
            <form class="toolbar-row" [formGroup]="filters" novalidate>
              <mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>Status</mat-label>
                <mat-select formControlName="status"><mat-option [value]="null">Any</mat-option>@for (s of statuses; track s) { <mat-option [value]="s">{{ s | leaveStatus }}</mat-option> }</mat-select></mat-form-field>
              <mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>Type</mat-label>
                <mat-select formControlName="leaveTypeId"><mat-option [value]="null">Any</mat-option>@for (t of types(); track t.id) { <mat-option [value]="t.id">{{ t.name }}</mat-option> }</mat-select></mat-form-field>
              <mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>From</mat-label><input matInput type="date" formControlName="from" /></mat-form-field>
              <mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>To</mat-label><input matInput type="date" formControlName="to" /></mat-form-field>
              <div class="emp"><app-employee-select label="Employee" formControlName="employeeId" status="ALL" /></div>
            </form>
            @if (filters.hasError('dateRange')) { <p class="err" role="alert">“To” must not be before “From”.</p> }
            <app-error-message [error]="result().error" (retry)="reload()" />
            <app-data-table testId="admin-leave-table" [columns]="columns" [rows]="result().items" [meta]="result().meta" [clickable]="true" emptyIcon="beach_access" emptyTitle="No leave requests match"
              (pageChange)="page.set($event.page); limit.set($event.limit)" (rowClick)="open($event)">
              <ng-template appCell="leaveType" let-r>{{ r.leaveType.name }}</ng-template>
              <ng-template appCell="period" let-r>{{ asDate(r.startDate) | date: 'MMM d, y' }}@if (r.startDate !== r.endDate) { – {{ asDate(r.endDate) | date: 'MMM d, y' }} }</ng-template>
              <ng-template appCell="status" let-r><app-status-badge [value]="r.status" [label]="r.status | leaveStatus" /></ng-template>
            </app-data-table>
          </div>
        </mat-tab>

        <mat-tab label="Adjust balance">
          <div class="panel tab narrow">
            <p class="muted">Positive amounts add days, negative amounts deduct. Every adjustment is audited with your note.</p>
            <form [formGroup]="adjust" (ngSubmit)="submitAdjust()" novalidate data-testid="adjust-form">
              <app-employee-select label="Employee" formControlName="employeeId" status="ALL" />
              <mat-form-field appearance="outline" class="full-width"><mat-label>Leave type</mat-label>
                <mat-select formControlName="leaveTypeId">@for (t of types(); track t.id) { <mat-option [value]="t.id">{{ t.name }}</mat-option> }</mat-select>
                <mat-error>{{ errA('leaveTypeId', 'Leave type') }}</mat-error></mat-form-field>
              <div class="form-grid">
                <mat-form-field appearance="outline"><mat-label>Year</mat-label><input matInput type="text" inputmode="numeric" appNumbersOnly maxlength="4" formControlName="year" /><mat-error>{{ errA('year', 'Year') }}</mat-error></mat-form-field>
                <mat-form-field appearance="outline"><mat-label>Amount (days)</mat-label><input matInput type="number" step="0.5" formControlName="amount" data-testid="adjust-amount" /><mat-error>{{ errA('amount', 'Amount') }}</mat-error></mat-form-field>
              </div>
              <mat-form-field appearance="outline" class="full-width"><mat-label>Note</mat-label><input matInput formControlName="note" /><mat-error>{{ errA('note', 'Note') }}</mat-error></mat-form-field>
              <button mat-flat-button color="primary" type="submit" [disabled]="adjusting()" data-testid="adjust-submit">Apply adjustment</button>
            </form>
          </div>
        </mat-tab>

        <mat-tab label="Leave types">
          <div class="panel tab">
            <div class="toolbar-row"><button mat-flat-button type="button" (click)="editType(null)"><mat-icon>add</mat-icon> New leave type</button></div>
            <app-data-table testId="leave-types-table" [columns]="typeColumns" [rows]="allTypes()" emptyIcon="category" emptyTitle="No leave types">
              <ng-template appCell="policy" let-t>{{ t.policy ? t.policy.annualEntitlement + ' days/yr' + (t.policy.allowHalfDay ? ' · half-day' : '') : '—' }}</ng-template>
              <ng-template appCell="isPaid" let-t>{{ t.isPaid ? 'Paid' : 'Unpaid' }}</ng-template>
              <ng-template appCell="isActive" let-t><app-status-badge [value]="t.isActive" [label]="t.isActive ? 'Active' : 'Inactive'" /></ng-template>
              <ng-template appCell="actions" let-t><div class="row-actions"><button mat-icon-button type="button" aria-label="Edit leave type" (click)="editType(t)"><mat-icon>edit</mat-icon></button></div></ng-template>
            </app-data-table>
          </div>
        </mat-tab>
      </mat-tab-group>
    </div>
  `,
  styles: `.tab { margin-top: 12px; } .narrow { max-width: 620px; } .emp { flex: 1 1 260px; margin-bottom: -22px; } .err { color: #b3261e; font-size: 13px; }`,
})
export class LeaveAdminComponent {
  private readonly svc = inject(LeaveService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly toast = inject(ToastService);
  private readonly reference = inject(ReferenceDataService);

  protected readonly asDate = parseIsoDate;
  protected readonly statuses = LEAVE_STATUSES;
  protected readonly types = toSignal(this.reference.leaveTypes(), { initialValue: [] });
  protected readonly page = signal(1);
  protected readonly limit = signal(10);
  protected readonly tick = signal(0);
  protected readonly adjusting = signal(false);
  private readonly typesTick = signal(0);

  protected readonly filters = this.fb.group(
    {
      status: this.fb.control<LeaveStatus | null>(null),
      leaveTypeId: this.fb.control<number | null>(null),
      employeeId: this.fb.control<number | null>(null),
      from: [''],
      to: [''],
    },
    { validators: dateRange('from', 'to') },
  );
  private readonly filterValue = toSignal(
    this.filters.valueChanges.pipe(debounceTime(250), startWith(null), map(() => (this.filters.valid ? this.filters.getRawValue() : null))),
    { initialValue: this.filters.getRawValue() },
  );

  protected readonly columns: TableColumn[] = [
    { key: 'employeeName', label: 'Employee' }, { key: 'leaveType', label: 'Type' }, { key: 'period', label: 'Period' },
    { key: 'days', label: 'Days', align: 'end' }, { key: 'status', label: 'Status' },
  ];

  protected readonly result = toSignal(
    toObservable(computed(() => ({ f: this.filterValue(), page: this.page(), limit: this.limit(), t: this.tick() }))).pipe(
      switchMap(({ f, page, limit }) =>
        f
          ? this.svc.list({ ...f, from: f.from || null, to: f.to || null, page, limit }).pipe(
              map((p): Result => ({ items: p.items, meta: p.meta, error: null })),
              catchError((error: AppError) => of<Result>({ items: [], meta: null, error })),
            )
          : of<Result>({ items: [], meta: null, error: null }),
      ),
    ),
    { initialValue: { items: [], meta: null, error: null } as Result },
  );

  protected readonly allTypes = toSignal(
    toObservable(this.typesTick).pipe(switchMap(() => this.svc.allTypes().pipe(catchError(() => of([] as LeaveType[]))))),
    { initialValue: [] as LeaveType[] },
  );
  protected readonly typeColumns: TableColumn[] = [
    { key: 'code', label: 'Code' }, { key: 'name', label: 'Name' }, { key: 'policy', label: 'Policy' },
    { key: 'isPaid', label: 'Paid' }, { key: 'isActive', label: 'Status' }, { key: 'actions', label: '', align: 'end' },
  ];

  protected readonly adjust = this.fb.group({
    employeeId: this.fb.control<number | null>(null, Validators.required),
    leaveTypeId: this.fb.control<number | null>(null, Validators.required),
    year: [new Date().getFullYear(), [Validators.required, Validators.min(2000), Validators.max(2100)]],
    amount: this.fb.control<number | null>(null, [Validators.required, Validators.min(-366), Validators.max(366), nonZero]),
    note: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(300)]],
  });
  protected readonly errA = (n: 'leaveTypeId' | 'year' | 'amount' | 'note', l: string) => {
    const c = this.adjust.controls[n];
    return c.hasError('nonZero') ? 'Amount must not be zero' : errorMessage(c, l);
  };

  protected reload(): void {
    this.tick.update((n) => n + 1);
  }

  protected open(r: LeaveRequest): void {
    void this.router.navigate(['/leaves', r.id]);
  }

  protected submitAdjust(): void {
    this.adjust.markAllAsTouched();
    if (this.adjust.invalid || this.adjusting()) return;
    const v = this.adjust.getRawValue();
    this.adjusting.set(true);
    this.svc.adjustBalance({ employeeId: v.employeeId!, leaveTypeId: v.leaveTypeId!, year: Number(v.year), amount: Number(v.amount), note: v.note.trim() }).subscribe({
      next: () => {
        this.toast.success('Balance adjusted');
        this.adjusting.set(false);
        this.adjust.patchValue({ amount: null, note: '' });
        this.adjust.markAsUntouched();
      },
      error: (e: AppError) => {
        this.adjusting.set(false);
        this.toast.error(e.message);
      },
    });
  }

  protected editType(t: LeaveType | null): void {
    this.dialog.open<LeaveTypeDialogComponent, LeaveType | null, boolean>(LeaveTypeDialogComponent, { data: t, maxWidth: '95vw' }).afterClosed().subscribe((ok) => {
      if (ok) {
        this.toast.success(t ? 'Leave type updated' : 'Leave type created');
        this.typesTick.update((n) => n + 1);
      }
    });
  }
}
