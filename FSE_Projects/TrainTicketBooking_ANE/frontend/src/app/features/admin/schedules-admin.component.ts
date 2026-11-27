import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormRecord, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { finalize, map } from 'rxjs';
import { toApiError } from '../../core/interceptors/error.interceptor';
import type { Train, TrainSchedule } from '../../core/models/models';
import { ScheduleService, TrainService } from '../../core/services/catalog.services';
import { ToastService } from '../../core/services/toast.service';
import { Column, DataTableComponent } from '../../shared/components/data-table.component';
import { ConfirmService, FieldErrorComponent, PageHeaderComponent } from '../../shared/components/ui.components';
import { listState } from '../../shared/list-state';
import { WeekdaysPipe } from '../../shared/pipes/pipes';
import { DAY_NAMES, fromIsoDate, toIsoDate } from '../../shared/utils';
import { applyServerErrors } from '../../shared/validators/validators';

@Component({
  selector: 'app-schedule-dialog', imports: [ReactiveFormsModule, MatDialogModule, MatButtonModule, MatCheckboxModule, MatDatepickerModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatSlideToggleModule, FieldErrorComponent], changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<h2 mat-dialog-title>{{ data ? 'Edit schedule' : 'New schedule' }}</h2><form [formGroup]="form" (ngSubmit)="save()" novalidate><mat-dialog-content class="dc">
    <mat-form-field><mat-label>Train</mat-label><mat-select formControlName="trainId">@for (t of trains(); track t.id) { <mat-option [value]="t.id">{{ t.number }} {{ t.name }}</mat-option> }</mat-select><mat-error><app-field-error [control]="form.controls.trainId" label="Train" /></mat-error></mat-form-field>
    <div class="two">
      <mat-form-field><mat-label>Valid from</mat-label><input matInput [matDatepicker]="a" formControlName="validFrom" /><mat-datepicker-toggle matIconSuffix [for]="a" /><mat-datepicker #a /><mat-error><app-field-error [control]="form.controls.validFrom" label="Start date" /></mat-error></mat-form-field>
      <mat-form-field><mat-label>Valid to (optional)</mat-label><input matInput [matDatepicker]="b" formControlName="validTo" /><mat-datepicker-toggle matIconSuffix [for]="b" /><mat-datepicker #b /><mat-error>@if (form.hasError('range')) { Must be on or after the start date } </mat-error></mat-form-field>
    </div>
    <fieldset class="days"><legend>Operating days</legend><div formGroupName="days">@for (d of dayKeys; track d) { <mat-checkbox [formControlName]="d">{{ dayNames[+d] }}</mat-checkbox> }</div></fieldset>
    @if (form.controls.days.touched && form.controls.days.hasError('noDay')) { <p class="err">Select at least one day.</p> }
    <mat-form-field><mat-label>Notes</mat-label><input matInput formControlName="notes" maxlength="255" /></mat-form-field>
    <mat-slide-toggle formControlName="active">Active</mat-slide-toggle>
    @if (error()) { <p class="err" role="alert">{{ error() }}</p> }</mat-dialog-content>
    <mat-dialog-actions align="end"><button mat-button type="button" mat-dialog-close>Cancel</button><button mat-flat-button type="submit" [disabled]="busy()">Save</button></mat-dialog-actions></form>`,
  styles: [`.dc{display:flex;flex-direction:column;gap:6px;min-width:min(520px,85vw)}.two{display:grid;grid-template-columns:1fr 1fr;gap:12px}.days{border:1px solid var(--c-border);border-radius:10px}.days div{display:flex;flex-wrap:wrap}`],
})
export class ScheduleDialogComponent {
  private readonly api = inject(ScheduleService); private readonly trainApi = inject(TrainService); private readonly ref = inject(MatDialogRef<ScheduleDialogComponent>); private readonly fb = inject(NonNullableFormBuilder);
  readonly data = inject<TrainSchedule | null>(MAT_DIALOG_DATA); readonly busy = signal(false); readonly error = signal('');
  readonly trains = signal<Train[]>([]); readonly dayNames = DAY_NAMES.map((d) => d.slice(0, 3)); readonly dayKeys = ['1', '2', '3', '4', '5', '6', '0'];
  readonly form = this.fb.group({
    trainId: new FormControl<number | null>(this.data?.trainId ?? null, [Validators.required]),
    validFrom: new FormControl<Date | null>(this.data ? fromIsoDate(this.data.validFrom.slice(0, 10)) : new Date(), [Validators.required]),
    validTo: new FormControl<Date | null>(this.data?.validTo ? fromIsoDate(this.data.validTo.slice(0, 10)) : null),
    active: [this.data?.active ?? true], notes: [this.data?.notes ?? ''],
    days: new FormRecord<FormControl<boolean>>(Object.fromEntries(this.dayKeys.map((d) => [d, this.fb.control(this.data ? this.data.operatingDays.some((o) => o.dayOfWeek === +d) : d !== '0')])), { validators: [(c) => (Object.values((c as FormRecord<FormControl<boolean>>).value).some(Boolean) ? null : { noDay: true })] }),
  }, { validators: [(g) => { const f = g.get('validFrom')?.value as Date | null, t = g.get('validTo')?.value as Date | null; return f && t && t < f ? { range: true } : null; }] });
  constructor() { this.trainApi.list({ size: 100, sort: 'number' }).pipe(map((p) => p.items)).subscribe((t) => this.trains.set(t)); if (this.data) this.form.controls.trainId.disable(); }
  save() {
    this.form.markAllAsTouched(); if (this.form.invalid || this.busy()) return; this.busy.set(true);
    const v = this.form.getRawValue();
    const body = { trainId: v.trainId, validFrom: toIsoDate(v.validFrom!), validTo: v.validTo ? toIsoDate(v.validTo) : null, active: v.active, notes: v.notes || undefined, operatingDays: Object.entries(v.days).filter(([, on]) => on).map(([d]) => Number(d)) };
    (this.data ? this.api.update(this.data.id, body) : this.api.create(body)).pipe(finalize(() => this.busy.set(false))).subscribe({ next: (s) => this.ref.close(s), error: (e) => { const er = toApiError(e); applyServerErrors(this.form, er.fields); this.error.set(er.message); } });
  }
}

@Component({
  selector: 'app-schedules-admin', imports: [MatButtonModule, MatIconModule, MatDialogModule, DataTableComponent, PageHeaderComponent], changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header title="Schedules" subtitle="When each train runs"><button mat-flat-button (click)="edit(null)"><mat-icon>add</mat-icon>New schedule</button></app-page-header>
    <app-data-table [columns]="columns" [rows]="l.rows()" [meta]="l.meta()" [loading]="l.loading()" [error]="l.error()" (pageChange)="l.page$.next($event)" (retry)="l.reload()">
      <ng-template #actions let-s><button mat-icon-button (click)="edit(s)" aria-label="Edit schedule"><mat-icon>edit</mat-icon></button><button mat-icon-button (click)="remove(s)" aria-label="Delete schedule"><mat-icon>delete</mat-icon></button></ng-template>
    </app-data-table>`,
})
export class SchedulesAdminComponent {
  private readonly api = inject(ScheduleService); private readonly dialog = inject(MatDialog); private readonly toast = inject(ToastService); private readonly confirm = inject(ConfirmService);
  readonly l = listState<TrainSchedule>((q) => this.api.list(q), { size: 10 });
  private readonly wd = new WeekdaysPipe();
  readonly columns: Column<TrainSchedule>[] = [
    { key: 'train', label: 'Train', value: (s) => (s.train ? `${s.train.number} ${s.train.name}` : '') }, { key: 'days', label: 'Days', value: (s) => this.wd.transform(s.operatingDays) },
    { key: 'validFrom', label: 'From', kind: 'date' }, { key: 'validTo', label: 'To', kind: 'date' }, { key: 'notes', label: 'Notes', value: (s) => s.notes ?? '' },
    { key: 'active', label: 'Status', kind: 'chip', value: (s) => (s.active ? 'ACTIVE' : 'INACTIVE') },
  ];
  edit(s: TrainSchedule | null) { this.dialog.open(ScheduleDialogComponent, { data: s }).afterClosed().subscribe((r) => { if (r) { this.toast.success('Schedule saved. Affected passengers were notified.'); this.l.reload(); } }); }
  async remove(s: TrainSchedule) { if (await this.confirm.ask({ title: 'Delete schedule?', message: 'The train will no longer run on these days.', confirmText: 'Delete', danger: true })) this.api.remove(s.id).subscribe({ next: () => { this.toast.success('Schedule deleted.'); this.l.reload(); }, error: (e) => this.toast.error(toApiError(e).message) }); }
}
