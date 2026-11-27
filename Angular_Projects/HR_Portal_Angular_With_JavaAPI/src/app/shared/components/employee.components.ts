import { ChangeDetectionStrategy, Component, computed, effect, forwardRef, inject, input, signal, untracked } from '@angular/core';
import { NG_VALUE_ACCESSOR, ReactiveFormsModule, FormControl, type ControlValueAccessor } from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatInputModule } from '@angular/material/input';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { injectOp } from '../../api/queries/op-query';
import { EmployeeLookupService } from './employee-lookup.service';
import type { DirectoryEntry } from '../../api/types/employee';

@Component({
  selector: 'app-employee-name', standalone: true, changeDetection: ChangeDetectionStrategy.OnPush,
  template: `@if (!id()) { <span class="text-muted">{{ fallback() || '—' }}</span> } @else { <span [title]="id()!">{{ e()?.fullName ?? fallback() ?? (id()!.slice(0, 8) + '…') }}@if (e()?.employeeCode) { <span class="text-muted"> · {{ e()!.employeeCode }}</span> }</span> }`,
})
export class EmployeeNameComponent {
  private svc = inject(EmployeeLookupService);
  id = input<string | null | undefined>(); fallback = input<string>();
  e = computed(() => this.svc.map().get(this.id() ?? ''));
  constructor() { effect(() => { const i = this.id(); untracked(() => this.svc.request(i)); }); }
}

/** Async employee autocomplete (company directory search, debounced). Value = employee id. */
@Component({
  selector: 'app-employee-picker', standalone: true, imports: [ReactiveFormsModule, MatAutocompleteModule, MatInputModule], changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => EmployeePickerComponent), multi: true }],
  template: `<mat-form-field appearance="outline" subscriptSizing="dynamic"><input matInput [formControl]="text" [matAutocomplete]="auto" [placeholder]="placeholder()" autocomplete="off" (blur)="onTouched()" [attr.aria-label]="label()">
      @if (loading()) { <i matSuffix class="pi pi-spin pi-spinner me-2"></i> }
      <mat-autocomplete #auto="matAutocomplete" [displayWith]="display" (optionSelected)="pick($event.option.value)">
        @for (o of options(); track o.id) { <mat-option [value]="o">{{ o.label }}</mat-option> }
        @if (!options().length && !loading()) { <mat-option disabled>—</mat-option> }
      </mat-autocomplete></mat-form-field>`,
})
export class EmployeePickerComponent implements ControlValueAccessor {
  private lookup = inject(EmployeeLookupService);
  label = input('Employee'); placeholder = input('Search by name or code');
  text = new FormControl<any>('');
  private q = toSignal(this.text.valueChanges.pipe(debounceTime(300), distinctUntilChanged()), { initialValue: '' });
  private selectedId = signal<string | null>(null);
  private term = computed(() => { const v = this.q(); return typeof v === 'string' ? v.trim() : ''; });
  private list = injectOp<{ content: DirectoryEntry[] }>('employee.directory', () => ({ query: { q: this.term() || undefined, size: 20 } }), () => ({ staleTime: 60_000 }));
  loading = this.list.isFetching;
  options = computed(() => (this.list.data()?.content ?? []).map((e) => ({ id: e.id!, label: `${e.fullName} (${e.employeeCode})` })));
  private onChange: (v: string | null) => void = () => {}; onTouched = () => {};
  display = (o: any) => (o && typeof o === 'object' ? o.label : o ?? '');
  constructor() {
    this.text.valueChanges.subscribe((v) => { if (typeof v === 'string' && this.selectedId()) { this.selectedId.set(null); this.onChange(null); } });
    effect(() => {
      const id = this.selectedId(); const e = id ? this.lookup.map().get(id) : null;
      if (id && e && typeof untracked(() => this.text.value) !== 'object') this.text.setValue({ id, label: `${e.fullName} (${e.employeeCode})` }, { emitEvent: false });
    });
  }
  pick(o: { id: string }) { this.selectedId.set(o.id); this.onChange(o.id); }
  writeValue(id: string | null) {
    this.selectedId.set(id || null);
    if (!id) { this.text.setValue('', { emitEvent: false }); return; }
    this.lookup.request(id);
    const e = this.lookup.get(id); if (e) this.text.setValue({ id, label: `${e.fullName} (${e.employeeCode})` }, { emitEvent: false });
  }
  registerOnChange(fn: (v: string | null) => void) { this.onChange = fn; }
  registerOnTouched(fn: () => void) { this.onTouched = fn; }
  setDisabledState(d: boolean) { d ? this.text.disable({ emitEvent: false }) : this.text.enable({ emitEvent: false }); }
}
void toObservable;
