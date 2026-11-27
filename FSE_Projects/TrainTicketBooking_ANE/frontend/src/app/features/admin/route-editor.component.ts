import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { StationAutocompleteComponent } from '../../shared/components/station-autocomplete.component';
import { FieldErrorComponent } from '../../shared/components/ui.components';
import { RouteGroup, StopGroup, newStop, syncStops } from './route-form';

/** Reusable route editor: dynamic FormArray of stops, reorder by drag & drop (CDK), conditional arrival/departure controls. */
@Component({
  selector: 'app-route-editor', imports: [ReactiveFormsModule, DragDropModule, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule, StationAutocompleteComponent, FieldErrorComponent], changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div [formGroup]="route()">
      <mat-form-field class="full"><mat-label>Route name</mat-label><input matInput formControlName="name" /><mat-error><app-field-error [control]="route().controls.name" label="Route name" /></mat-error></mat-form-field>
      <h3>Stops <small class="muted">(drag the handle to reorder)</small></h3>
      <div formArrayName="stops" cdkDropList (cdkDropListDropped)="drop($event)" class="list">
        @for (s of stops; track s; let i = $index) {
          <div class="stop card" cdkDrag [formGroupName]="i">
            <mat-icon cdkDragHandle class="h" aria-label="Drag to reorder">drag_indicator</mat-icon>
            <span class="n">{{ i + 1 }}</span>
            <div class="f">
              <app-station-autocomplete [control]="s.controls.station" label="Station" />
              <mat-form-field class="t"><mat-label>Arrival</mat-label><input matInput type="time" formControlName="arrivalTime" /><mat-error><app-field-error [control]="s.controls.arrivalTime" label="Arrival" /></mat-error></mat-form-field>
              <mat-form-field class="t"><mat-label>Departure</mat-label><input matInput type="time" formControlName="departureTime" /><mat-error><app-field-error [control]="s.controls.departureTime" label="Departure" /></mat-error></mat-form-field>
              <mat-form-field class="t"><mat-label>Day +</mat-label><input matInput type="number" min="0" max="5" formControlName="dayOffset" /></mat-form-field>
              <mat-form-field class="t"><mat-label>Km</mat-label><input matInput type="number" min="0" formControlName="distanceKm" /><mat-error><app-field-error [control]="s.controls.distanceKm" label="Distance" /></mat-error></mat-form-field>
            </div>
            <button mat-icon-button type="button" (click)="remove(i)" [disabled]="stops.length <= 2" [attr.aria-label]="'Remove stop ' + (i + 1)"><mat-icon>delete</mat-icon></button>
          </div>
        }
      </div>
      @if (route().hasError('minStops')) { <p class="err">A route needs at least 2 stops.</p> }
      @if (route().hasError('duplicateStation')) { <p class="err">A station can appear only once in a route.</p> }
      @if (route().hasError('distanceOrder')) { <p class="err">Distance must not decrease along the route.</p> }
      <button mat-stroked-button type="button" (click)="add()"><mat-icon>add</mat-icon>Add stop</button>
    </div>`,
  styles: [`.stop{display:flex;align-items:flex-start;gap:8px;margin:8px 0;padding:12px}.h{cursor:grab;margin-top:14px;color:var(--c-muted)}.n{margin-top:18px;font-weight:700;min-width:20px}.f{flex:1;display:grid;grid-template-columns:2fr repeat(4,1fr);gap:8px}.cdk-drag-preview{box-shadow:var(--shadow)}.cdk-drag-placeholder{opacity:.3}
    @media (max-width:900px){.f{grid-template-columns:1fr 1fr}.f app-station-autocomplete{grid-column:1/-1}}`],
})
export class RouteEditorComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  readonly route = input.required<RouteGroup>();
  get stops(): StopGroup[] { return this.route().controls.stops.controls; }
  add() { this.route().controls.stops.push(newStop(this.fb)); syncStops(this.route()); this.route().markAsDirty(); }
  remove(i: number) { this.route().controls.stops.removeAt(i); syncStops(this.route()); this.route().markAsDirty(); }
  drop(e: CdkDragDrop<StopGroup[]>) { const arr = this.route().controls.stops; moveItemInArray(arr.controls, e.previousIndex, e.currentIndex); syncStops(this.route()); arr.updateValueAndValidity(); this.route().markAsDirty(); }
}
