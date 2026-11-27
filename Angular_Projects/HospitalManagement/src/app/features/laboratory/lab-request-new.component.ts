import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, effect, inject, input } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { SelectButtonModule } from 'primeng/selectbutton';
import { TextareaModule } from 'primeng/textarea';
import { map } from 'rxjs';
import { DoctorApiService } from '../../core/api/doctor-api.service';
import { PatientApiService } from '../../core/api/patient-api.service';
import { AuthService } from '../../core/auth/auth.service';
import type { HasUnsavedChanges } from '../../core/guards/unsaved-changes.guard';
import type { LabPriority } from '../../core/models';
import { CurrentIdentityService } from '../../core/services/current-identity.service';
import { PageHeaderComponent, PatientPickerComponent } from '../../shared/components';
import { emptyToNull } from '../../shared/utilities/helpers';
import { LabRequestStore } from '../../state/feature-stores/lab-request.store';

/**
 * Scenario 4 – LAB REQUEST (PrimeNG + NgRx ComponentStore + typed Reactive Forms).
 *   patient → doctor → dynamic rows (FormArray of test selects) → priority → submit: one POST per test (forkJoin inside the store effect, exhaustMap).
 * The ComponentStore is provided in `providers`, so its lifetime = this component's lifetime.
 */
@Component({
  selector: 'app-lab-request-new',
  standalone: true,
  imports: [CurrencyPipe, FormsModule, ReactiveFormsModule, RouterLink, ButtonModule, InputTextModule, SelectModule, SelectButtonModule, TextareaModule, PageHeaderComponent, PatientPickerComponent],
  providers: [LabRequestStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let vm = (vm$)();
    <div class="mx-auto max-w-3xl"><app-page-header title="New lab request" subtitle="Order one or more tests" />
      @if (vm.outcomes; as outs) {
        <div class="space-y-3 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900"><h2 class="font-semibold">Result</h2>
          <ul class="space-y-1 text-sm">@for (o of outs; track o.testCode) { <li>@if (o.ok) { ✔ <b>{{ o.testCode }}</b> – request <a [routerLink]="['/laboratory/requests', o.request!.id]">#{{ o.request!.id }}</a> created } @else { <span class="text-red-700">✘ <b>{{ o.testCode }}</b> – {{ o.error }}</span> }</li> }</ul>
          <div class="flex gap-2"><a routerLink="/laboratory/requests"><p-button label="Go to requests" /></a><p-button label="Order more" severity="secondary" [outlined]="true" (onClick)="again()" /></div></div>
      } @else {
        <form [formGroup]="form" (ngSubmit)="submit()" class="space-y-4" novalidate aria-label="Lab request form">
          @if (vm.error) { <p role="alert" class="rounded-md bg-red-50 p-3 text-sm text-red-800">{{ vm.error }}</p> }
          <section class="space-y-3 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900"><h2 class="font-semibold">Patient & doctor</h2>
            <app-patient-picker [patient]="vm.patient" (patientChange)="store.setPatient($event)" />
            @if (auth.role() === 'DOCTOR') { <p class="text-sm text-slate-500">Requesting as <b>{{ ownDoctor()?.fullName ?? '…' }}</b></p> }
            @else { <p-select [options]="doctors()" optionLabel="label" optionValue="id" [ngModel]="vm.doctorId" [ngModelOptions]="{ standalone: true }" (ngModelChange)="store.setDoctor($event)" placeholder="Requesting doctor" styleClass="w-full" ariaLabel="Requesting doctor" /> }
            <div><div class="mb-1 text-xs text-slate-500">Priority</div><p-selectbutton [options]="priorities" [ngModel]="vm.priority" [ngModelOptions]="{ standalone: true }" (ngModelChange)="store.setPriority($event ?? 'ROUTINE')" ariaLabelledBy="priority" /></div></section>
          <section class="space-y-3 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900"><h2 class="font-semibold">Tests</h2>
            <div formArrayName="tests" class="space-y-2">@for (c of tests.controls; track c; let i = $index) {
              <div class="flex items-center gap-2"><p-select [options]="optionsFor(vm.catalogue, c.value)" optionLabel="label" optionValue="code" [formControlName]="i" placeholder="Choose a test" [filter]="true" filterBy="label" styleClass="w-full" [attr.data-testid]="'lab-test-' + i" [ariaLabel]="'Test ' + (i + 1)" /><p-button icon="pi pi-trash" severity="danger" [text]="true" type="button" (onClick)="removeRow(i)" [disabled]="tests.length === 1" [ariaLabel]="'Remove test ' + (i + 1)" /></div> }</div>
            <p-button label="Add test" icon="pi pi-plus" severity="secondary" [outlined]="true" type="button" (onClick)="addRow()" />
            <textarea pTextarea rows="2" class="w-full" formControlName="notes" placeholder="Clinical notes (optional)" aria-label="Clinical notes"></textarea>
            <div class="flex items-center justify-between border-t pt-3 text-sm"><span>{{ vm.selected.length }} test(s)</span><span class="font-semibold">Estimated total {{ vm.total | currency }}</span></div></section>
          <div class="flex justify-end gap-2"><a routerLink="/laboratory/requests"><p-button label="Cancel" severity="secondary" [text]="true" type="button" /></a><p-button type="submit" label="Submit request" [loading]="vm.submitting" /></div>
        </form> }
    </div>`,
})
export class LabRequestNewComponent implements OnInit, HasUnsavedChanges {
  readonly patientId = input<string | undefined>();
  readonly appointmentId = input<string | undefined>();
  protected readonly store = inject(LabRequestStore);
  protected readonly auth = inject(AuthService);
  protected readonly vm$ = toSignal(this.store.vm$, { requireSync: true });
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly patientsApi = inject(PatientApiService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly ownDoctor = toSignal(inject(CurrentIdentityService).doctor$);
  protected readonly doctors = toSignal(inject(DoctorApiService).list({ active: true, size: 100 }).pipe(map((p) => p.content.map((d) => ({ id: d.id, label: `${d.fullName} — ${d.specialization}` })))), { initialValue: [] });
  protected readonly priorities: LabPriority[] = ['ROUTINE', 'URGENT', 'STAT'];
  protected readonly tests = this.fb.array<FormControl<string>>([this.fb.control('', Validators.required)]);
  protected readonly form = this.fb.group({ tests: this.tests, notes: ['', Validators.maxLength(1000)] });
  private done = false;

  constructor() {
    this.tests.valueChanges.pipe(takeUntilDestroyed()).subscribe((codes) => this.store.setSelected(codes));
    effect(() => { const d = this.ownDoctor(); if (d && this.auth.role() === 'DOCTOR') this.store.setDoctor(d.id); });
    effect(() => { const id = this.patientId(); if (id) this.patientsApi.getById(Number(id)).pipe(takeUntilDestroyed(this.destroyRef)).subscribe((p) => this.store.setPatient(p)); });
  }
  ngOnInit() { this.store.loadCatalogue(); }
  /** Options exclude tests already chosen in other rows (no duplicates), but keep this row's own choice. */
  protected optionsFor(cat: readonly { code: string; name: string; price: number }[], current: string) {
    const taken = new Set(this.tests.value.filter((c) => c && c !== current));
    return cat.filter((t) => !taken.has(t.code)).map((t) => ({ code: t.code, label: `${t.code} – ${t.name} ($${t.price})` }));
  }
  protected addRow() { this.tests.push(this.fb.control('', Validators.required)); }
  protected removeRow(i: number) { if (this.tests.length > 1) this.tests.removeAt(i); }
  protected again() { this.store.reset(); this.tests.clear(); this.addRow(); this.form.reset({ notes: '' }); this.done = false; }
  protected submit() {
    this.form.markAllAsTouched();
    this.store.submit({ notes: emptyToNull(this.form.controls.notes.value), appointmentId: Number(this.appointmentId()) || null });
    this.done = true;
  }
  hasUnsavedChanges() { return !this.done && (this.form.dirty || !!this.vm$().patient); }
}
