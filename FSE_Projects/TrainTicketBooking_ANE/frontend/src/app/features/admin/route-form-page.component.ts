import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, FormControl, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { finalize } from 'rxjs';
import type { Train } from '../../core/models/models';
import type { HasUnsavedChanges } from '../../core/guards/guards';
import { toApiError } from '../../core/interceptors/error.interceptor';
import { TrainService } from '../../core/services/catalog.services';
import { ToastService } from '../../core/services/toast.service';
import { PageHeaderComponent } from '../../shared/components/ui.components';
import { RouteEditorComponent } from './route-editor.component';
import { RouteGroup, buildRoute, routePayload } from './route-form';

/** Create a route for a train that has none (POST /routes) or edit an existing one (PUT /routes/:id). `id` comes from the route params. */
@Component({
  selector: 'app-route-form-page', imports: [ReactiveFormsModule, RouterLink, MatButtonModule, MatFormFieldModule, MatSelectModule, PageHeaderComponent, RouteEditorComponent], changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header [title]="id() ? 'Edit route' : 'New route'" subtitle="Stops, timings and distances"><a mat-stroked-button routerLink="/admin/routes">Cancel</a></app-page-header>
    <form (ngSubmit)="save()" novalidate>
      @if (!id()) {
        <mat-form-field style="min-width:320px"><mat-label>Train (without a route)</mat-label>
          <mat-select [formControl]="trainId">@for (t of trains(); track t.id) { <mat-option [value]="t.id">{{ t.number }} {{ t.name }}</mat-option> } @empty { <mat-option disabled>All trains already have a route</mat-option> }</mat-select></mat-form-field>
      }
      <div class="card"><app-route-editor [route]="route()" /></div>
      @if (error()) { <p class="err" role="alert">{{ error() }}</p> }
      <p><button mat-flat-button type="submit" [disabled]="busy()">Save route</button></p>
    </form>`,
})
export class RouteFormPageComponent implements HasUnsavedChanges {
  private readonly fb = inject(NonNullableFormBuilder); private readonly api = inject(TrainService); private readonly router = inject(Router); private readonly toast = inject(ToastService);
  readonly id = input<string>();
  readonly route = signal<RouteGroup>(buildRoute(this.fb));
  readonly trains = signal<Train[]>([]); readonly trainId = new FormControl<number | null>(null, [Validators.required]);
  readonly busy = signal(false); readonly error = signal(''); private done = false;
  constructor() {
    effect(() => { const id = this.id(); if (id) this.api.route(+id).subscribe((r) => this.route.set(buildRoute(this.fb, r))); else this.api.list({ size: 100, sort: 'number' }).subscribe((p) => this.trains.set(p.items.filter((t) => !t.route))); });
  }
  hasUnsavedChanges() { return !this.done && this.route().dirty; }
  save() {
    const g = this.route(); g.markAllAsTouched(); this.trainId.markAsTouched();
    if (g.invalid || (!this.id() && this.trainId.invalid) || this.busy()) { this.error.set('Please fix the highlighted fields.'); return; }
    this.error.set(''); this.busy.set(true);
    const body = routePayload(g);
    (this.id() ? this.api.updateRoute(+this.id()!, body) : this.api.createRoute(this.trainId.value!, body)).pipe(finalize(() => this.busy.set(false))).subscribe({
      next: () => { this.done = true; this.toast.success('Route saved.'); void this.router.navigate(['/admin/routes']); }, error: (e) => this.error.set(toApiError(e).message),
    });
  }
}
