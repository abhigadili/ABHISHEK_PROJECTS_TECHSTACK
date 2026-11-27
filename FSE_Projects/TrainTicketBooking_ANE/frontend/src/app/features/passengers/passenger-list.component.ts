import { DatePipe, TitleCasePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { FormControl, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatBottomSheet, MatBottomSheetModule, MAT_BOTTOM_SHEET_DATA } from '@angular/material/bottom-sheet';
import { finalize, startWith } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import type { Booking, SavedPassenger } from '../../core/models/models';
import { PassengerService } from '../../core/services/account.services';
import { toApiError } from '../../core/interceptors/error.interceptor';
import { ToastService } from '../../core/services/toast.service';
import { ConfirmService, EmptyStateComponent, ErrorStateComponent, FieldErrorComponent, PageHeaderComponent } from '../../shared/components/ui.components';
import { DigitsOnlyDirective } from '../../shared/directives/directives';
import { PnrPipe } from '../../shared/pipes/pipes';
import { ageRange, applyServerErrors, indianMobile } from '../../shared/validators/validators';

@Component({
  selector: 'app-passenger-dialog',
  imports: [ReactiveFormsModule, MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatSelectModule, FieldErrorComponent, DigitsOnlyDirective],
  template: `
    <h2 mat-dialog-title>{{ data ? 'Edit' : 'Add' }} passenger</h2>
    <form [formGroup]="form" (ngSubmit)="save()" novalidate>
      <mat-dialog-content class="dc">
        <mat-form-field><mat-label>Full name</mat-label><input matInput formControlName="name" /><mat-error><app-field-error [control]="form.controls.name" label="Name" /></mat-error></mat-form-field>
        <div class="two">
          <mat-form-field><mat-label>Age</mat-label><input matInput type="number" formControlName="age" /><mat-error><app-field-error [control]="form.controls.age" label="Age" /></mat-error></mat-form-field>
          <mat-form-field><mat-label>Gender</mat-label><mat-select formControlName="gender"><mat-option value="MALE">Male</mat-option><mat-option value="FEMALE">Female</mat-option><mat-option value="OTHER">Other</mat-option></mat-select><mat-error><app-field-error [control]="form.controls.gender" label="Gender" /></mat-error></mat-form-field>
        </div>
        <mat-form-field><mat-label>Mobile (optional)</mat-label><input matInput formControlName="mobile" maxlength="10" appDigitsOnly /><mat-error><app-field-error [control]="form.controls.mobile" label="Mobile" /></mat-error></mat-form-field>
        <mat-form-field><mat-label>ID type (optional)</mat-label><mat-select formControlName="idType"><mat-option value="">None</mat-option><mat-option value="AADHAAR">Aadhaar</mat-option><mat-option value="PASSPORT">Passport</mat-option><mat-option value="DRIVING_LICENCE">Driving licence</mat-option><mat-option value="VOTER_ID">Voter ID</mat-option></mat-select></mat-form-field>
        <mat-form-field><mat-label>ID number</mat-label><input matInput formControlName="idNumber" maxlength="30" autocomplete="off" /><mat-hint>Only the last 4 characters are stored by the server.</mat-hint><mat-error><app-field-error [control]="form.controls.idNumber" label="ID number" /></mat-error></mat-form-field>
        @if (error()) { <p class="err" role="alert">{{ error() }}</p> }
      </mat-dialog-content>
      <mat-dialog-actions align="end"><button mat-button type="button" mat-dialog-close>Cancel</button><button mat-flat-button type="submit" [disabled]="busy()">Save</button></mat-dialog-actions>
    </form>`,
  styles: [`.dc{display:flex;flex-direction:column;gap:4px;min-width:min(420px,80vw)}.two{display:grid;grid-template-columns:1fr 1fr;gap:12px}`],
})
export class PassengerDialogComponent {
  private readonly fb = inject(NonNullableFormBuilder); private readonly api = inject(PassengerService); private readonly ref = inject(MatDialogRef<PassengerDialogComponent>);
  readonly data = inject<SavedPassenger | null>(MAT_DIALOG_DATA);
  readonly busy = signal(false); readonly error = signal('');
  readonly form = this.fb.group({
    name: [this.data?.name ?? '', [Validators.required, Validators.minLength(2), Validators.maxLength(120)]],
    age: new FormControl<number | null>(this.data?.age ?? null, [Validators.required, ageRange]),
    gender: [this.data?.gender ?? '', Validators.required], mobile: [this.data?.mobile ?? '', indianMobile],
    idType: [this.data?.idType ?? ''], idNumber: [{ value: '', disabled: !this.data?.idType }, [Validators.maxLength(30), Validators.minLength(4)]],
  });
  constructor() {
    // conditional controls: the ID number is only enabled (and required) once an ID type is chosen
    this.form.controls.idType.valueChanges.pipe(startWith(this.form.controls.idType.value), takeUntilDestroyed()).subscribe((t) => {
      const c = this.form.controls.idNumber;
      if (t) { c.enable({ emitEvent: false }); c.addValidators(Validators.required); } else { c.disable({ emitEvent: false }); c.removeValidators(Validators.required); c.reset('', { emitEvent: false }); }
      c.updateValueAndValidity({ emitEvent: false });
    });
  }
  save() {
    this.form.markAllAsTouched(); if (this.form.invalid || this.busy()) return;
    const v = this.form.getRawValue(); const body = { name: v.name.trim(), age: Number(v.age), gender: v.gender, mobile: v.mobile, idType: v.idType, ...(v.idType && v.idNumber ? { idNumber: v.idNumber } : {}) };
    this.busy.set(true);
    (this.data ? this.api.update(this.data.id, body) : this.api.create(body)).pipe(finalize(() => this.busy.set(false))).subscribe({
      next: (p) => this.ref.close(p), error: (e) => { const err = toApiError(e); applyServerErrors(this.form, err.fields); this.error.set(err.message); },
    });
  }
}

@Component({
  selector: 'app-passenger-history', imports: [DatePipe, PnrPipe, EmptyStateComponent], template: `
    <h3>Travel history · {{ data.name }}</h3>
    @for (h of data.rows; track h.id) { <p>{{ h.booking.departureAt | date: 'dd MMM yyyy' }} · {{ h.booking.train.number }} {{ h.booking.train.name }} · {{ h.booking.fromStation.code }}→{{ h.booking.toStation.code }} · PNR {{ h.booking.pnr?.pnr | pnr }}</p> } @empty { <app-empty-state icon="history" title="No trips yet" /> }`,
})
export class PassengerHistorySheetComponent { readonly data = inject<{ name: string; rows: { id: number; booking: Booking }[] }>(MAT_BOTTOM_SHEET_DATA); }

@Component({
  selector: 'app-passenger-list',
  imports: [TitleCasePipe, MatButtonModule, MatIconModule, MatDialogModule, MatBottomSheetModule, PageHeaderComponent, EmptyStateComponent, ErrorStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header title="Saved passengers" subtitle="Reuse co-travellers when you book"><button mat-flat-button (click)="edit(null)"><mat-icon>person_add</mat-icon>Add passenger</button></app-page-header>
    @if (error()) { <app-error-state [message]="error()!" (retry)="load()" /> }
    @else {
      <div class="grid cols-3">
        @for (p of items(); track p.id) {
          <article class="card"><div class="row spread"><strong>{{ p.name }}</strong><span class="muted">{{ p.age }} · {{ p.gender | titlecase }}</span></div>
            <p class="muted">{{ p.mobile || 'No mobile' }}@if (p.idType) { · {{ p.idType.replace('_', ' ') | titlecase }} ••••{{ p.idLast4 }} }</p>
            <div class="row"><button mat-button (click)="edit(p)"><mat-icon>edit</mat-icon>Edit</button><button mat-button (click)="history(p)"><mat-icon>history</mat-icon>History</button><button mat-button color="warn" (click)="remove(p)"><mat-icon>delete</mat-icon>Remove</button></div></article>
        } @empty { @if (!loading()) { <div class="card" style="grid-column:1/-1"><app-empty-state icon="groups" title="No saved passengers" message="Add the people you travel with often." /></div> } }
      </div>
    }`,
})
export class PassengerListComponent implements OnInit {
  private readonly api = inject(PassengerService); private readonly dialog = inject(MatDialog); private readonly sheet = inject(MatBottomSheet); private readonly toast = inject(ToastService); private readonly confirm = inject(ConfirmService);
  readonly items = signal<SavedPassenger[]>([]); readonly loading = signal(true); readonly error = signal<string | null>(null);
  ngOnInit() { this.load(); }
  load() { this.loading.set(true); this.error.set(null); this.api.list({ size: 100 }).pipe(finalize(() => this.loading.set(false))).subscribe({ next: (r) => this.items.set(r.items), error: (e) => this.error.set(toApiError(e).message) }); }
  edit(p: SavedPassenger | null) { this.dialog.open(PassengerDialogComponent, { data: p, autoFocus: 'first-tabbable' }).afterClosed().subscribe((r) => { if (r) { this.toast.success('Passenger saved.'); this.load(); } }); }
  history(p: SavedPassenger) { this.api.history(p.id).subscribe((rows) => this.sheet.open(PassengerHistorySheetComponent, { data: { name: p.name, rows } })); }
  async remove(p: SavedPassenger) { if (await this.confirm.ask({ title: 'Remove passenger?', message: `${p.name} will be removed from your saved list. Past bookings are not affected.`, confirmText: 'Remove', danger: true })) this.api.remove(p.id).subscribe({ next: () => { this.toast.success('Passenger removed.'); this.load(); } }); }
}
