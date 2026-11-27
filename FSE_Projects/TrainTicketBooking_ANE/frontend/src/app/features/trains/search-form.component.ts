import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, input, OnInit } from '@angular/core';
import { FormControl, FormGroup, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { APP_CONFIG } from '../../core/config/tokens';
import type { Station } from '../../core/models/models';
import { LookupService } from '../../core/services/catalog.services';
import { SearchHistoryService } from '../../core/services/search-history.service';
import { StationAutocompleteComponent } from '../../shared/components/station-autocomplete.component';
import { FieldErrorComponent } from '../../shared/components/ui.components';
import { addDays, fromIsoDate, today, toIsoDate } from '../../shared/utils';
import { differentStations, notPastDate, stationSelected } from '../../shared/validators/validators';

/** Reactive train-search form (typed FormGroup, cross-field validator, swap, class selector). Reused on the home page, dashboard and results page. */
@Component({
  selector: 'app-search-form',
  imports: [ReactiveFormsModule, AsyncPipe, MatButtonModule, MatDatepickerModule, MatFormFieldModule, MatIconModule, MatInputModule, MatSelectModule, StationAutocompleteComponent, FieldErrorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form [formGroup]="form" (ngSubmit)="submit()" class="sf" novalidate aria-label="Train search">
      <app-station-autocomplete [control]="form.controls.from" label="From" icon="trip_origin" />
      <button mat-icon-button type="button" class="swap" (click)="swap()" aria-label="Swap source and destination"><mat-icon>swap_horiz</mat-icon></button>
      <app-station-autocomplete [control]="form.controls.to" label="To" icon="place" />
      <mat-form-field>
        <mat-label>Journey date</mat-label>
        <input matInput [matDatepicker]="dp" [min]="min" [max]="max" formControlName="date" (focus)="dp.open()" />
        <mat-datepicker-toggle matIconSuffix [for]="dp" /><mat-datepicker #dp />
        <mat-error><app-field-error [control]="form.controls.date" label="Date" /></mat-error>
      </mat-form-field>
      <mat-form-field class="narrow">
        <mat-label>Passengers</mat-label>
        <mat-select formControlName="passengers">@for (n of counts; track n) { <mat-option [value]="n">{{ n }}</mat-option> }</mat-select>
      </mat-form-field>
      <mat-form-field>
        <mat-label>Class</mat-label>
        <mat-select formControlName="coachTypeId">
          <mat-option [value]="null">Any class</mat-option>
          @for (c of (lookups.coachTypes$ | async); track c.id) { <mat-option [value]="c.id">{{ c.name }} ({{ c.code }})</mat-option> }
        </mat-select>
      </mat-form-field>
      <button mat-flat-button type="submit" class="go"><mat-icon>search</mat-icon> Search trains</button>
    </form>
    @if (form.hasError('sameStation') && form.touched) { <p class="err" role="alert">Source and destination must differ.</p> }`,
  styles: [`.sf{display:grid;grid-template-columns:1fr auto 1fr;gap:8px 12px;align-items:start}.swap{margin-top:6px}.narrow{max-width:none}.go{grid-column:1/-1;height:52px;font-size:1rem}
    .sf>mat-form-field{grid-column:span 1}@media (max-width:700px){.sf{grid-template-columns:1fr}.swap{justify-self:center;margin:-8px 0}}`],
})
export class SearchFormComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly router = inject(Router);
  private readonly history = inject(SearchHistoryService);
  readonly lookups = inject(LookupService);
  readonly cfg = inject(APP_CONFIG);
  readonly initial = input<{ from?: Station; to?: Station; date?: string; passengers?: number; coachTypeId?: number } | null>(null);
  readonly min = today(); readonly max = addDays(today(), 120);
  readonly counts = Array.from({ length: this.cfg.maxPassengers }, (_, i) => i + 1);
  readonly form = new FormGroup({
    from: new FormControl<Station | string | null>(null, { validators: [Validators.required, stationSelected] }),
    to: new FormControl<Station | string | null>(null, { validators: [Validators.required, stationSelected] }),
    date: new FormControl<Date | null>(addDays(today(), 1), { validators: [Validators.required, notPastDate] }),
    passengers: this.fb.control(1, [Validators.min(1), Validators.max(this.cfg.maxPassengers)]),
    coachTypeId: new FormControl<number | null>(null),
  }, { validators: differentStations });

  ngOnInit() {
    const i = this.initial();
    if (i) this.form.patchValue({ from: i.from ?? null, to: i.to ?? null, date: i.date ? fromIsoDate(i.date) : undefined, passengers: i.passengers ?? 1, coachTypeId: i.coachTypeId ?? null });
  }
  swap() { const { from, to } = this.form.getRawValue(); this.form.patchValue({ from: to, to: from }); }
  submit() {
    this.form.markAllAsTouched(); if (this.form.invalid) return;
    const v = this.form.getRawValue(); const from = v.from as Station; const to = v.to as Station;
    this.history.add({ fromId: from.id, fromName: from.name, toId: to.id, toName: to.name });
    void this.router.navigate(['/search'], { queryParams: { from: from.id, to: to.id, date: toIsoDate(v.date!), pax: v.passengers, cls: v.coachTypeId ?? undefined } });
  }
}
