import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormArray, FormControl, FormGroup, FormRecord, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { finalize } from 'rxjs';
import type { Train, TrainPayload, TrainStatus, TrainType } from '../../core/models/models';
import { AuthService } from '../../core/auth/auth.service';
import type { HasUnsavedChanges } from '../../core/guards/guards';
import { toApiError } from '../../core/interceptors/error.interceptor';
import { LookupService, TrainService } from '../../core/services/catalog.services';
import { ToastService } from '../../core/services/toast.service';
import { FieldErrorComponent, PageHeaderComponent } from '../../shared/components/ui.components';
import { DAY_NAMES } from '../../shared/utils';
import { applyServerErrors } from '../../shared/validators/validators';
import { RouteEditorComponent } from './route-editor.component';
import { RouteGroup, buildRoute, routePayload } from './route-form';

/**
 * Create / edit train. One component, two modes (resolver supplies `train` when editing).
 * Create: number, name, type, status, optional route, coach plan (FormArray), operating days (FormRecord).
 * Edit: the backend only accepts name, type, status and route; coaches/schedule are managed on the detail page.
 */
@Component({
  selector: 'app-train-form',
  imports: [ReactiveFormsModule, RouterLink, AsyncPipe, MatButtonModule, MatCheckboxModule, MatFormFieldModule, MatIconModule, MatInputModule, MatSelectModule, PageHeaderComponent, FieldErrorComponent, RouteEditorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header [title]="train() ? 'Edit ' + train()!.number : 'New train'" subtitle="Train, route, coaches and operating days"><a mat-stroked-button routerLink="/admin/trains">Cancel</a></app-page-header>
    <form [formGroup]="form" (ngSubmit)="save()" novalidate>
      <section class="card"><h2>Train</h2>
        <div class="grid cols-4">
          <mat-form-field><mat-label>Number</mat-label><input matInput formControlName="number" maxlength="6" inputmode="numeric" /><mat-hint>4-6 digits</mat-hint><mat-error><app-field-error [control]="form.controls.number" label="Number" /></mat-error></mat-form-field>
          <mat-form-field style="grid-column:span 2"><mat-label>Name</mat-label><input matInput formControlName="name" /><mat-error><app-field-error [control]="form.controls.name" label="Name" /></mat-error></mat-form-field>
          <mat-form-field><mat-label>Type</mat-label><mat-select formControlName="type">@for (t of types; track t) { <mat-option [value]="t">{{ t }}</mat-option> }</mat-select></mat-form-field>
          <mat-form-field><mat-label>Status</mat-label><mat-select formControlName="status">@for (t of statuses; track t) { <mat-option [value]="t">{{ t }}</mat-option> }</mat-select></mat-form-field>
        </div>
      </section>
      <section class="card" style="margin-top:16px"><h2>Route</h2>
        <mat-checkbox [checked]="withRoute()" (change)="withRoute.set($event.checked)" [disabled]="!!train()?.route">Define the route now</mat-checkbox>
        @if (withRoute()) { <app-route-editor [route]="route" /> }
      </section>
      @if (!train()) {
        <section class="card" style="margin-top:16px"><h2>Coaches</h2>
          <div formArrayName="coaches">
            @for (c of coaches.controls; track c; let i = $index) {
              <div class="row" [formGroupName]="i">
                <mat-form-field style="min-width:220px"><mat-label>Class</mat-label><mat-select formControlName="coachTypeId">@for (k of (lookups.coachTypes$ | async); track k.id) { <mat-option [value]="k.id">{{ k.name }} ({{ k.seatsPerCoach }} seats)</mat-option> }</mat-select><mat-error><app-field-error [control]="c.controls.coachTypeId" label="Class" /></mat-error></mat-form-field>
                <mat-form-field style="width:110px"><mat-label>Coaches</mat-label><input matInput type="number" min="1" max="20" formControlName="count" /><mat-error><app-field-error [control]="c.controls.count" label="Count" /></mat-error></mat-form-field>
                <button mat-icon-button type="button" (click)="coaches.removeAt(i)" [attr.aria-label]="'Remove coach plan ' + (i + 1)"><mat-icon>delete</mat-icon></button>
              </div>
            }
          </div>
          <button mat-stroked-button type="button" (click)="addCoach()" [disabled]="coaches.length >= 12"><mat-icon>add</mat-icon>Add coach class</button>
        </section>
        <section class="card" style="margin-top:16px"><h2>Operating days</h2>
          <div class="row" formGroupName="days">@for (d of dayKeys; track d) { <mat-checkbox [formControlName]="d">{{ dayNames[+d] }}</mat-checkbox> }</div>
        </section>
      }
      @if (error()) { <p class="err" role="alert">{{ error() }}</p> }
      <div class="row" style="margin-top:16px"><button mat-flat-button type="submit" [disabled]="busy()">{{ busy() ? 'Saving…' : 'Save train' }}</button></div>
    </form>`,
})
export class TrainFormComponent implements HasUnsavedChanges {
  private readonly fb = inject(NonNullableFormBuilder); private readonly api = inject(TrainService); private readonly router = inject(Router); private readonly toast = inject(ToastService);
  readonly lookups = inject(LookupService); readonly auth = inject(AuthService);
  readonly train = input<Train | null>(null);
  readonly types: TrainType[] = ['EXPRESS', 'SUPERFAST', 'SUBURBAN', 'PASSENGER', 'PREMIUM']; readonly statuses: TrainStatus[] = ['ACTIVE', 'INACTIVE', 'SUSPENDED'];
  readonly dayNames = DAY_NAMES.map((d) => d.slice(0, 3)); readonly dayKeys = ['1', '2', '3', '4', '5', '6', '0'];
  readonly withRoute = signal(true); readonly busy = signal(false); readonly error = signal(''); private done = false;
  route: RouteGroup = buildRoute(this.fb);
  readonly form = this.fb.group({
    number: ['', [Validators.required, Validators.pattern(/^\d{4,6}$/)]], name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(120)]],
    type: this.fb.control<TrainType>('EXPRESS'), status: this.fb.control<TrainStatus>('ACTIVE'),
    coaches: this.fb.array<FormGroup<{ coachTypeId: FormControl<number | null>; count: FormControl<number> }>>([]),
    days: new FormRecord<FormControl<boolean>>(Object.fromEntries(['1', '2', '3', '4', '5', '6', '0'].map((d) => [d, this.fb.control(d !== '0')]))),
  });
  get coaches() { return this.form.controls.coaches; }
  constructor() {
    this.addCoach();
    effect(() => {
      const t = this.train(); if (!t) return;
      this.form.controls.number.disable(); this.form.patchValue({ number: t.number, name: t.name, type: t.type, status: t.status });
      this.route = buildRoute(this.fb, t.route); this.withRoute.set(!!t.route);
    });
  }
  hasUnsavedChanges() { return !this.done && (this.form.dirty || this.route.dirty); }
  addCoach() { this.coaches.push(this.fb.group({ coachTypeId: new FormControl<number | null>(null, [Validators.required]), count: this.fb.control(1, [Validators.required, Validators.min(1), Validators.max(20)]) })); }
  save() {
    this.form.markAllAsTouched(); this.route.markAllAsTouched();
    const t = this.train();
    if (this.form.invalid || (this.withRoute() && this.route.invalid) || this.busy()) { this.error.set('Please fix the highlighted fields.'); return; }
    this.error.set(''); this.busy.set(true);
    const v = this.form.getRawValue();
    const route = this.withRoute() ? routePayload(this.route) : undefined;
    const req = t
      ? this.api.update(t.id, { name: v.name.trim(), type: v.type, status: v.status, ...(route ? { route } : {}) })
      : this.api.create({ number: v.number, name: v.name.trim(), type: v.type, status: v.status, ...(route ? { route } : {}),
          coaches: v.coaches.filter((c) => c.coachTypeId).map((c) => ({ coachTypeId: c.coachTypeId!, count: Number(c.count) })),
          operatingDays: Object.entries(v.days).filter(([, on]) => on).map(([d]) => Number(d)) } as TrainPayload);
    req.pipe(finalize(() => this.busy.set(false))).subscribe({
      next: (saved) => { this.done = true; this.toast.success('Train saved.'); void this.router.navigate(['/admin/trains', saved.id]); },
      error: (e) => { const er = toApiError(e); applyServerErrors(this.form, er.fields); this.error.set(er.message); },
    });
  }
}
