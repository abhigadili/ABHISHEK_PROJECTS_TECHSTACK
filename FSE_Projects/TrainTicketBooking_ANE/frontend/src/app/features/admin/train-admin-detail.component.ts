import { AsyncPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';
import { FormControl, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { RouterLink, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { finalize } from 'rxjs';
import type { CoachSeat, Train, TrainCoach, TrainStatus } from '../../core/models/models';
import { LookupService, SeatService, TrainService } from '../../core/services/catalog.services';
import { toApiError } from '../../core/interceptors/error.interceptor';
import { ToastService } from '../../core/services/toast.service';
import { ConfirmService, EmptyStateComponent, FieldErrorComponent, PageHeaderComponent, StatusChipComponent } from '../../shared/components/ui.components';
import { CanDirective, UppercaseDirective } from '../../shared/directives/directives';
import { WeekdaysPipe, StationPipe } from '../../shared/pipes/pipes';
import { toIsoDate, today } from '../../shared/utils';
import { applyServerErrors } from '../../shared/validators/validators';

@Component({
  selector: 'app-coach-dialog', imports: [ReactiveFormsModule, AsyncPipe, MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatSelectModule, FieldErrorComponent, UppercaseDirective], changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<h2 mat-dialog-title>Add coach</h2><form [formGroup]="form" (ngSubmit)="save()" novalidate><mat-dialog-content class="dc">
    <mat-form-field><mat-label>Class</mat-label><mat-select formControlName="coachTypeId">@for (k of (lookups.coachTypes$ | async); track k.id) { <mat-option [value]="k.id">{{ k.name }}</mat-option> }</mat-select><mat-error><app-field-error [control]="form.controls.coachTypeId" label="Class" /></mat-error></mat-form-field>
    <mat-form-field><mat-label>Coach number</mat-label><input matInput formControlName="number" appUppercase maxlength="3" /><mat-hint>e.g. S1, B2, A1</mat-hint><mat-error><app-field-error [control]="form.controls.number" label="Number" /></mat-error></mat-form-field>
    @if (error()) { <p class="err" role="alert">{{ error() }}</p> }</mat-dialog-content>
    <mat-dialog-actions align="end"><button mat-button type="button" mat-dialog-close>Cancel</button><button mat-flat-button type="submit" [disabled]="busy()">Add</button></mat-dialog-actions></form>`,
  styles: [`.dc{display:flex;flex-direction:column;min-width:min(360px,80vw)}`],
})
export class CoachDialogComponent {
  readonly lookups = inject(LookupService); private readonly api = inject(TrainService); private readonly ref = inject(MatDialogRef<CoachDialogComponent>); private readonly fb = inject(NonNullableFormBuilder);
  readonly trainId = inject<number>(MAT_DIALOG_DATA); readonly busy = signal(false); readonly error = signal('');
  readonly form = this.fb.group({ coachTypeId: new FormControl<number | null>(null, [Validators.required]), number: ['', [Validators.required, Validators.pattern(/^[A-Z]\d{1,2}$/)]] });
  save() { this.form.markAllAsTouched(); if (this.form.invalid) return; this.busy.set(true); const v = this.form.getRawValue(); this.api.addCoach(this.trainId, { coachTypeId: v.coachTypeId!, number: v.number }).pipe(finalize(() => this.busy.set(false))).subscribe({ next: (c) => this.ref.close(c), error: (e) => { const er = toApiError(e); applyServerErrors(this.form, er.fields); this.error.set(er.message); } }); }
}

@Component({
  selector: 'app-seats-dialog', imports: [MatDialogModule, MatButtonModule], changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<h2 mat-dialog-title>Seats · coach {{ data.number }}</h2><mat-dialog-content>
    <p class="muted">Click a seat to block / unblock it. A seat with upcoming reservations cannot be blocked (the server refuses).</p>
    <div class="grid">@for (s of seats(); track s.id) { <button type="button" class="seat" [class.bl]="s.status === 'BLOCKED'" (click)="toggle(s)" [attr.aria-label]="'Seat ' + s.seatNumber + ' ' + s.status">{{ s.seatNumber }}</button> }</div>
    @if (error()) { <p class="err" role="alert">{{ error() }}</p> }</mat-dialog-content><mat-dialog-actions align="end"><button mat-button mat-dialog-close>Close</button></mat-dialog-actions>`,
  styles: [`.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(44px,1fr));gap:6px;min-width:min(520px,80vw)}.seat{height:38px;border-radius:8px;border:1px solid var(--c-border);background:#e5f6e8;cursor:pointer;font-weight:600}.seat.bl{background:#e3e3e3;text-decoration:line-through}`],
})
export class SeatsDialogComponent {
  private readonly api = inject(SeatService); readonly data = inject<TrainCoach>(MAT_DIALOG_DATA);
  readonly seats = signal<CoachSeat[]>([]); readonly error = signal('');
  constructor() { this.api.coachSeats(this.data.id).subscribe((r) => this.seats.set(r.seats)); }
  toggle(s: CoachSeat) { const next = s.status === 'ACTIVE' ? 'BLOCKED' : 'ACTIVE'; this.error.set(''); this.api.setStatus(s.id, next).subscribe({ next: () => this.seats.update((list) => list.map((x) => (x.id === s.id ? { ...x, status: next } : x))), error: (e) => this.error.set(toApiError(e).message) }); }
}

@Component({
  selector: 'app-train-admin-detail',
  imports: [DatePipe, ReactiveFormsModule, RouterLink, MatButtonModule, MatDatepickerModule, MatDialogModule, MatFormFieldModule, MatIconModule, MatInputModule, MatMenuModule, MatSlideToggleModule, PageHeaderComponent, StatusChipComponent, EmptyStateComponent, CanDirective, WeekdaysPipe, StationPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (t(); as t) {
      <app-page-header [title]="t.number + ' · ' + t.name" [subtitle]="t.type"><app-status-chip [status]="t.status" />
        <button mat-stroked-button [matMenuTriggerFor]="sm"><mat-icon>swap_vert</mat-icon>Status</button>
        <mat-menu #sm="matMenu">@for (s of statuses; track s) { <button mat-menu-item [disabled]="s === t.status" (click)="setStatus(s)">{{ s }}</button> }</mat-menu>
        <a *appCan="'train:manage'" mat-flat-button routerLink="edit"><mat-icon>edit</mat-icon>Edit</a></app-page-header>
      <div class="grid cols-2">
        <section class="card"><h2>Route @if (t.route) { <small class="muted">· {{ t.route.name }}</small> }</h2>
          @for (s of t.route?.stops ?? []; track s.seq) { <p class="row spread"><span>{{ s.seq }}. {{ s.station | station }}</span><small class="muted">{{ s.arrivalTime ?? '—' }} / {{ s.departureTime ?? '—' }} · {{ s.distanceKm }} km</small></p> } @empty { <app-empty-state icon="alt_route" title="No route" message="Create one from Routes." /> }</section>
        <section class="card"><h2>Schedules</h2>
          @for (s of t.schedules; track s.id) { <p><strong>{{ s.operatingDays | weekdays }}</strong> · {{ s.validFrom | date: 'dd MMM yyyy' }} → {{ s.validTo ? (s.validTo | date: 'dd MMM yyyy') : 'open' }} <app-status-chip [status]="s.active ? 'ACTIVE' : 'INACTIVE'" /></p> } @empty { <p class="muted">No schedule. Add one under Schedules.</p> }
          <h2 style="margin-top:16px">Date exceptions</h2>
          @for (o of t.overrides ?? []; track o.id) { <p class="row spread"><span>{{ o.date | date: 'EEE dd MMM yyyy' }} · {{ o.cancelled ? 'cancelled' : 'restored' }} {{ o.reason ? '(' + o.reason + ')' : '' }}</span><button mat-icon-button (click)="removeOverride(o.id)" aria-label="Remove exception"><mat-icon>close</mat-icon></button></p> } @empty { <p class="muted">None.</p> }
          <form class="row" [formGroup]="ov" (ngSubmit)="addOverride()">
            <mat-form-field style="width:170px"><mat-label>Date</mat-label><input matInput [matDatepicker]="dp" [min]="min" formControlName="date" /><mat-datepicker-toggle matIconSuffix [for]="dp" /><mat-datepicker #dp /></mat-form-field>
            <mat-form-field style="flex:1;min-width:140px"><mat-label>Reason</mat-label><input matInput formControlName="reason" maxlength="200" /></mat-form-field>
            <button mat-stroked-button type="submit" [disabled]="ov.invalid">Cancel this date</button></form>
        </section>
      </div>
      <section class="card" style="margin-top:16px"><div class="row spread"><h2>Coaches</h2><button mat-stroked-button (click)="addCoach()"><mat-icon>add</mat-icon>Add coach</button></div>
        <div class="coaches">@for (c of coaches(); track c.id) { <div class="coach"><strong>{{ c.number }}</strong><small>{{ c.coachType.name }} · {{ c._count?.seats }} seats</small>
          <span><button mat-button (click)="seats(c)">Seats</button><button mat-icon-button (click)="removeCoach(c)" [attr.aria-label]="'Remove coach ' + c.number"><mat-icon>delete</mat-icon></button></span></div> } @empty { <app-empty-state icon="train" title="No coaches" /> }</div>
      </section>
      <p *appCan="'train:manage'"><button mat-button color="warn" (click)="remove()"><mat-icon>delete</mat-icon>Delete train</button></p>
    }`,
  styles: [`.coaches{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px}.coach{display:flex;flex-direction:column;border:1px solid var(--c-border);border-radius:10px;padding:10px}`],
})
export class TrainAdminDetailComponent {
  private readonly api = inject(TrainService); private readonly dialog = inject(MatDialog); private readonly toast = inject(ToastService); private readonly confirm = inject(ConfirmService); private readonly router = inject(Router);
  private readonly seatApi = inject(SeatService); private readonly fb = inject(NonNullableFormBuilder);
  readonly train = input<Train | null>(null);
  readonly t = signal<Train | null>(null); readonly coaches = signal<TrainCoach[]>([]);
  readonly statuses: TrainStatus[] = ['ACTIVE', 'INACTIVE', 'SUSPENDED']; readonly min = today();
  readonly ov = this.fb.group({ date: new FormControl<Date | null>(null, [Validators.required]), reason: [''] });
  constructor() { effect(() => { const x = this.train(); if (x) { this.t.set(x); this.loadCoaches(x.id); } }); }
  private loadCoaches(id: number) { this.api.coaches(id).subscribe((c) => this.coaches.set(c)); }
  private refresh() { const id = this.t()!.id; this.api.get(id).subscribe((x) => this.t.set(x)); }
  async setStatus(s: TrainStatus) { const r = await this.confirm.ask({ title: `Set status to ${s}?`, message: 'Passengers with upcoming bookings are notified when a train is taken out of service.', confirmText: 'Update', withReason: true }); if (!r) return; this.api.setStatus(this.t()!.id, s, typeof r === 'object' ? r.reason || undefined : undefined).subscribe({ next: (x) => { this.t.update((o) => ({ ...o!, status: x.status })); this.toast.success('Status updated.'); }, error: (e) => this.toast.error(toApiError(e).message) }); }
  addOverride() { if (this.ov.invalid) return; const v = this.ov.getRawValue(); this.api.setOverride(this.t()!.id, { date: toIsoDate(v.date!), cancelled: true, reason: v.reason || undefined }).subscribe({ next: () => { this.toast.success('Date cancelled.'); this.ov.reset(); this.refresh(); }, error: (e) => this.toast.error(toApiError(e).message) }); }
  removeOverride(id: number) { this.api.removeOverride(this.t()!.id, id).subscribe(() => this.refresh()); }
  addCoach() { this.dialog.open(CoachDialogComponent, { data: this.t()!.id }).afterClosed().subscribe((c) => { if (c) { this.toast.success('Coach added.'); this.loadCoaches(this.t()!.id); } }); }
  seats(c: TrainCoach) { this.dialog.open(SeatsDialogComponent, { data: c, maxWidth: '95vw' }); }
  async removeCoach(c: TrainCoach) { if (await this.confirm.ask({ title: 'Remove coach?', message: `Coach ${c.number} and its seats will be deleted. Coaches with bookings cannot be removed - block their seats instead.`, confirmText: 'Remove', danger: true })) this.seatApi.removeCoach(c.id).subscribe({ next: () => { this.toast.success('Coach removed.'); this.loadCoaches(this.t()!.id); }, error: (e) => this.toast.error(toApiError(e).message) }); }
  async remove() { const t = this.t()!; if (await this.confirm.ask({ title: 'Delete train?', message: `${t.number} ${t.name} will be deleted permanently.`, confirmText: 'Delete', danger: true })) this.api.remove(t.id).subscribe({ next: () => { this.toast.success('Train deleted.'); void this.router.navigate(['/admin/trains']); }, error: (e) => this.toast.error(toApiError(e).message) }); }
}
