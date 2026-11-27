import { ChangeDetectionStrategy, Component, DestroyRef, inject, input, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { catchError, debounceTime, distinctUntilChanged, map, of, startWith, switchMap, tap } from 'rxjs';
import type { Station } from '../../core/models/models';
import { StationService } from '../../core/services/catalog.services';
import { FieldErrorComponent } from './ui.components';

/**
 * Station picker with debounced, cancellable suggestions: valueChanges -> debounceTime -> distinctUntilChanged -> switchMap
 * (the previous in-flight request is cancelled when the user types again). The control holds the selected Station object.
 */
@Component({
  selector: 'app-station-autocomplete',
  imports: [ReactiveFormsModule, MatAutocompleteModule, MatFormFieldModule, MatInputModule, MatIconModule, FieldErrorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mat-form-field appearance="outline" class="full">
      <mat-label>{{ label() }}</mat-label>
      <mat-icon matPrefix aria-hidden="true">{{ icon() }}</mat-icon>
      <input matInput type="text" [formControl]="control()" [matAutocomplete]="auto" autocomplete="off" [placeholder]="placeholder()" />
      <mat-autocomplete #auto="matAutocomplete" [displayWith]="display">
        @if (loading()) { <mat-option disabled>Searching…</mat-option> }
        @for (s of options(); track s.id) { <mat-option [value]="s"><strong>{{ s.code }}</strong> · {{ s.name }} <small class="muted">{{ s.city }}, {{ s.state }}</small></mat-option> }
      </mat-autocomplete>
      <mat-error><app-field-error [control]="control()" [label]="label()" /></mat-error>
    </mat-form-field>`,
})
export class StationAutocompleteComponent implements OnInit {
  private readonly stations = inject(StationService);
  private readonly destroyRef = inject(DestroyRef);
  readonly control = input.required<FormControl<Station | string | null>>();
  readonly label = input('Station'); readonly icon = input('place'); readonly placeholder = input('Type a city, name or code');
  readonly loading = signal(false);
  readonly options = signal<Station[]>([]);
  display = (s: Station | string | null) => (s && typeof s === 'object' ? `${s.name} (${s.code})` : (s ?? ''));
  ngOnInit() {
    // subscribed once for the component's lifetime (not tied to the lazily rendered overlay panel)
    this.control().valueChanges.pipe(
      startWith(this.control().value),
      map((v) => (typeof v === 'string' ? v.trim() : '')),
      debounceTime(250), distinctUntilChanged(),
      tap(() => this.loading.set(true)),
      switchMap((t) => this.stations.suggest(t).pipe(map((p) => p.items), catchError(() => of([] as Station[])))),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe((items) => { this.options.set(items); this.loading.set(false); });
  }
}
