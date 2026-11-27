import { Injectable, inject } from '@angular/core';
import { ComponentStore } from '@ngrx/component-store';
import { tapResponse } from '@ngrx/operators';
import { EMPTY, Observable, catchError, exhaustMap, forkJoin, map, of, switchMap, tap } from 'rxjs';
import { LaboratoryApiService } from '../../core/api/laboratory-api.service';
import { errorMessage } from '../../core/models/api-error';
import type { LabPriority, LabRequest, LabTest, Patient } from '../../core/models';

export interface LabRequestOutcome { readonly testCode: string; readonly ok: boolean; readonly request?: LabRequest; readonly error?: string }
export interface LabRequestBuilderState {
  readonly catalogue: readonly LabTest[];
  readonly loading: boolean;
  readonly patient: Patient | null;
  readonly doctorId: number | null;
  readonly priority: LabPriority;
  readonly selected: readonly string[];
  readonly submitting: boolean;
  readonly outcomes: readonly LabRequestOutcome[] | null;
  readonly error: string | null;
}

/**
 * NgRx COMPONENT STORE: local, component-scoped state for the lab-request builder (provided in the component's `providers`, so every
 * visit gets a fresh store that is destroyed with the component). Contrast with the global Store used for doctors/patients/billing:
 * this state is not needed anywhere else, so it does not belong in the global store.
 *   select()    → derived observables       updater() → synchronous state changes       effect() → async work with side effects
 */
@Injectable()
export class LabRequestStore extends ComponentStore<LabRequestBuilderState> {
  private readonly api = inject(LaboratoryApiService);
  constructor() {
    super({ catalogue: [], loading: false, patient: null, doctorId: null, priority: 'ROUTINE', selected: [], submitting: false, outcomes: null, error: null });
  }

  // ---- selectors
  readonly catalogue$ = this.select((s) => s.catalogue);
  readonly selected$ = this.select((s) => s.selected);
  readonly patient$ = this.select((s) => s.patient);
  readonly selectedTests$ = this.select(this.catalogue$, this.selected$, (cat, sel) => cat.filter((t) => sel.includes(t.code)));
  readonly total$ = this.select(this.selectedTests$, (tests) => tests.reduce((sum, t) => sum + t.price, 0));
  readonly vm$ = this.select(this.state$, this.total$, (s, total) => ({ ...s, total }));

  // ---- updaters
  readonly setPatient = this.updater<Patient | null>((s, patient) => ({ ...s, patient }));
  readonly setDoctor = this.updater<number | null>((s, doctorId) => ({ ...s, doctorId }));
  readonly setPriority = this.updater<LabPriority>((s, priority) => ({ ...s, priority }));
  readonly toggleTest = this.updater<string>((s, code) => ({ ...s, selected: s.selected.includes(code) ? s.selected.filter((c) => c !== code) : [...s.selected, code] }));
  readonly setSelected = this.updater<readonly string[]>((s, selected) => ({ ...s, selected: [...new Set(selected.filter(Boolean))] }));
  readonly reset = this.updater((s) => ({ ...s, patient: null, selected: [], outcomes: null, priority: 'ROUTINE', error: null }));

  // ---- effects
  readonly loadCatalogue = this.effect<void>((trigger$) => trigger$.pipe(
    tap(() => this.patchState({ loading: true, error: null })),
    switchMap(() => this.api.tests().pipe(tapResponse({ next: (catalogue) => this.patchState({ catalogue, loading: false }), error: (e) => this.patchState({ loading: false, error: errorMessage(e) }) }))),
  ));

  /** exhaustMap: ignore re-submits while the batch is running; forkJoin runs one POST per test in parallel; each failure is captured. */
  readonly submit = this.effect<{ notes: string | null; appointmentId: number | null }>((req$: Observable<{ notes: string | null; appointmentId: number | null }>) => req$.pipe(
    tap(() => this.patchState({ submitting: true, error: null })),
    exhaustMap(({ notes, appointmentId }) => {
      const s = this.get();
      if (!s.patient || !s.doctorId || s.selected.length === 0) { this.patchState({ submitting: false, error: 'Select a patient, a doctor and at least one test.' }); return EMPTY; }
      return forkJoin(s.selected.map((code) => this.api.createRequest({ patientId: s.patient!.id, doctorId: s.doctorId!, appointmentId, testCode: code, priority: s.priority, clinicalNotes: notes }).pipe(
        map((request): LabRequestOutcome => ({ testCode: code, ok: true, request })),
        catchError((e) => of<LabRequestOutcome>({ testCode: code, ok: false, error: errorMessage(e) })),
      ))).pipe(tap((outcomes) => this.patchState({ outcomes, submitting: false })));
    }),
  ));
}
