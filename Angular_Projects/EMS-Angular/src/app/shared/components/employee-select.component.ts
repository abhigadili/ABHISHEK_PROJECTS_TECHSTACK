import { ChangeDetectionStrategy, Component, DestroyRef, forwardRef, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ControlValueAccessor, FormControl, NG_VALUE_ACCESSOR, ReactiveFormsModule } from '@angular/forms';
import { MatAutocompleteModule, MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { catchError, debounceTime, distinctUntilChanged, filter, of, switchMap, tap } from 'rxjs';
import { Employee } from '../../core/models/employee.models';
import { EmployeeService } from '../../core/services/employee.service';

/**
 * Searchable employee picker implemented as a ControlValueAccessor: it plugs into Reactive Forms (`formControlName`)
 * and holds the employee **id** (number | null) as its value while showing a name in the input.
 *
 *  - writeValue(id)      model → view: loads the employee so the name can be displayed
 *  - registerOnChange    view → model: called when a suggestion is chosen or the field is cleared
 *  - registerOnTouched   blur
 *  - setDisabledState    form.disable()
 */
@Component({
  selector: 'app-employee-select',
  standalone: true,
  imports: [ReactiveFormsModule, MatAutocompleteModule, MatFormFieldModule, MatInputModule, MatIconModule, MatButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => EmployeeSelectComponent), multi: true }],
  template: `
    <mat-form-field appearance="outline" class="full">
      <mat-label>{{ label() }}</mat-label>
      <input matInput [formControl]="search" [matAutocomplete]="auto" (blur)="onTouched()" [attr.data-testid]="'employee-select'" autocomplete="off" />
      @if (selectedId() !== null && !search.disabled) {
        <button mat-icon-button matSuffix type="button" aria-label="Clear selection" (click)="clear()"><mat-icon>close</mat-icon></button>
      }
      <mat-autocomplete #auto="matAutocomplete" [displayWith]="display" (optionSelected)="onSelected($event)">
        @for (e of options(); track e.id) {
          <mat-option [value]="e">{{ e.fullName }} <small>· {{ e.employeeCode }}</small></mat-option>
        }
        @if (searching()) {
          <mat-option disabled>Searching…</mat-option>
        }
      </mat-autocomplete>
      <ng-content select="mat-hint" />
    </mat-form-field>
  `,
  styles: `.full { width: 100%; } small { color: var(--ems-muted); }`,
})
export class EmployeeSelectComponent implements ControlValueAccessor {
  private readonly employees = inject(EmployeeService);
  private readonly destroyRef = inject(DestroyRef);

  readonly label = input('Employee');
  /** Limit suggestions (e.g. only active people). */
  readonly status = input<'ACTIVE' | 'ALL'>('ACTIVE');

  protected readonly search = new FormControl<string | Employee>('', { nonNullable: true });
  protected readonly options = signal<Employee[]>([]);
  protected readonly searching = signal(false);
  protected readonly selectedId = signal<number | null>(null);

  private onChange: (value: number | null) => void = () => undefined;
  protected onTouched: () => void = () => undefined;

  constructor() {
    this.search.valueChanges
      .pipe(
        filter((v): v is string => typeof v === 'string'),
        tap((text) => {
          // typing after a selection invalidates it
          if (this.selectedId() !== null && text !== '') this.setSelected(null, true);
        }),
        debounceTime(250),
        distinctUntilChanged(),
        tap(() => this.searching.set(true)),
        switchMap((q) =>
          this.employees.list({ q, status: this.status(), limit: 8, page: 1 }).pipe(
            catchError(() => of({ items: [] as Employee[], meta: { page: 1, limit: 8, total: 0, totalPages: 0 } })),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((page) => {
        this.options.set(page.items);
        this.searching.set(false);
      });
  }

  protected display = (v: string | Employee | null): string => (typeof v === 'string' ? v : v ? `${v.fullName} (${v.employeeCode})` : '');

  writeValue(id: number | null): void {
    this.selectedId.set(id ?? null);
    if (!id) {
      this.search.setValue('', { emitEvent: false });
      return;
    }
    this.employees
      .get(id)
      .pipe(takeUntilDestroyed(this.destroyRef), catchError(() => of(null)))
      .subscribe((e) => this.search.setValue(e ?? '', { emitEvent: false }));
  }

  registerOnChange(fn: (value: number | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(disabled: boolean): void {
    if (disabled) this.search.disable({ emitEvent: false });
    else this.search.enable({ emitEvent: false });
  }

  protected onSelected(e: MatAutocompleteSelectedEvent): void {
    const emp = e.option.value as Employee;
    this.setSelected(emp.id, true);
  }

  protected clear(): void {
    this.search.setValue('');
    this.setSelected(null, true);
  }

  private setSelected(id: number | null, notify: boolean): void {
    this.selectedId.set(id);
    if (notify) this.onChange(id);
  }
}
