import { ChangeDetectionStrategy, Component, inject, input, model, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { catchError, debounceTime, distinctUntilChanged, filter, map, of, switchMap, tap } from 'rxjs';
import { PatientApiService } from '../../core/api/patient-api.service';
import type { Patient } from '../../core/models';
import { PatientNamePipe } from '../pipes/pipes';
import { ClickOutsideDirective } from '../directives/directives';

/**
 * Shared form control (model()): `<app-patient-picker [(patient)]="selected" />`.
 * Search pipeline = toObservable(signal) → debounceTime → distinctUntilChanged → switchMap(API) → toSignal(results).
 * switchMap cancels the previous request when the user keeps typing (request cancellation).
 */
@Component({
  selector: 'app-patient-picker',
  standalone: true,
  imports: [PatientNamePipe, ClickOutsideDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <label class="mb-1 block text-sm font-medium">{{ label() }}</label>
    @if (patient(); as p) {
      <div class="flex items-center justify-between rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-600">
        <span><b>{{ p | patientName }}</b> <span class="text-slate-500">#{{ p.id }} · {{ p.phone }}</span></span>
        <button type="button" class="text-slate-500 hover:text-slate-900 dark:hover:text-white" aria-label="Change patient" (click)="patient.set(null)">✕</button>
      </div>
    } @else {
      <div class="relative" (appClickOutside)="open.set(false)">
        <input class="h-10 w-full rounded-md border border-slate-300 bg-transparent px-3 text-sm dark:border-slate-600" placeholder="Search by name, e-mail or phone…" [value]="text()" (input)="onInput($event)" (focus)="open.set(true)" aria-label="Search patients" />
        @if (open()) {
          <ul class="absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-md border border-slate-200 bg-white shadow-lg dark:border-slate-600 dark:bg-slate-800" role="listbox">
            @if (searching()) { <li class="p-3 text-sm text-slate-500">Searching…</li> }
            @for (r of results(); track r.id) {
              <li><button type="button" class="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700" (click)="pick(r)"><span><b>{{ r | patientName }}</b> <span class="text-slate-500">#{{ r.id }}</span></span><span class="text-xs text-slate-500">{{ r.phone }}</span></button></li>
            } @empty { @if (!searching()) { <li class="p-3 text-sm text-slate-500">No matching patients.</li> } }
          </ul>
        }
      </div>
    }`,
})
export class PatientPickerComponent {
  private readonly api = inject(PatientApiService);
  readonly label = input('Patient');
  readonly patient = model<Patient | null>(null);
  protected readonly text = signal('');
  protected readonly open = signal(false);
  protected readonly searching = signal(false);

  protected readonly results = toSignal(
    toObservable(this.text).pipe(
      map((t) => t.trim()),
      debounceTime(300),
      distinctUntilChanged(),
      tap(() => this.searching.set(true)),
      switchMap((q) => this.api.list({ q: q || undefined, page: 0, size: 8 }).pipe(map((p) => p.content), catchError(() => of([] as Patient[])))),
      tap(() => this.searching.set(false)),
      filter(() => true),
    ),
    { initialValue: [] as Patient[] },
  );
  protected onInput(e: Event) { this.text.set((e.target as HTMLInputElement).value); this.open.set(true); }
  protected pick(p: Patient) { this.patient.set(p); this.open.set(false); this.text.set(''); }
}
