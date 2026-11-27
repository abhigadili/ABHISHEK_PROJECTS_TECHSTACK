import { ChangeDetectionStrategy, Component, effect, input, model, output, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { debounceTime, distinctUntilChanged, map } from 'rxjs';

/**
 * Debounced search field built on a standalone FormControl.
 *  - `value` is a model(): the parent can two-way bind `[(value)]` (e.g. from query params).
 *  - `searchChange` fires only after the user pauses typing and the text really changed.
 */
@Component({
  selector: 'app-search-box',
  standalone: true,
  imports: [ReactiveFormsModule, MatFormFieldModule, MatInputModule, MatIconModule, MatButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mat-form-field appearance="outline" subscriptSizing="dynamic" class="search">
      <mat-label>{{ label() }}</mat-label>
      <mat-icon matPrefix>search</mat-icon>
      <input matInput type="search" [formControl]="control" [placeholder]="placeholder()" [attr.aria-label]="label()" data-testid="search-input" />
      @if (control.value) {
        <button mat-icon-button matSuffix type="button" aria-label="Clear search" (click)="control.setValue('')">
          <mat-icon>close</mat-icon>
        </button>
      }
    </mat-form-field>
  `,
  styles: `.search { width: 100%; min-width: 220px; }`,
})
export class SearchBoxComponent {
  readonly label = input('Search');
  readonly placeholder = input('');
  readonly debounce = input(300);
  readonly value = model('');
  readonly searchChange = output<string>();

  protected readonly control = new FormControl('', { nonNullable: true });

  constructor() {
    // parent → control (emitEvent:false so we never echo the parent's own value back as a "user search")
    effect(() => {
      const incoming = this.value();
      untracked(() => {
        if (incoming !== this.control.value.trim()) this.control.setValue(incoming, { emitEvent: false });
      });
    });
    // control → parent, debounced, only real changes
    this.control.valueChanges
      .pipe(debounceTime(this.debounce()), map((v) => v.trim()), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((v) => {
        this.value.set(v);
        this.searchChange.emit(v);
      });
  }
}
