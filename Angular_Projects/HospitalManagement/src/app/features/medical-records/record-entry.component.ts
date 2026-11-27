import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SkeletonModule } from 'primeng/skeleton';
import { TagModule } from 'primeng/tag';
import { TextareaModule } from 'primeng/textarea';
import { MedicalRecordApiService } from '../../core/api/medical-record-api.service';
import { AuthService } from '../../core/auth/auth.service';
import { ApiError } from '../../core/models/api-error';
import { NotificationService } from '../../core/services/notification.service';
import { ErrorStateComponent, PageHeaderComponent } from '../../shared/components';
import { RecordDatePipe } from '../../shared/pipes/pipes';
import { humanize } from '../../shared/utilities/helpers';

const REF_ROUTE: Record<string, (id: number) => string> = { PRESCRIPTION: (id) => `/prescriptions/${id}`, LAB_REPORT: (id) => `/lab/requests/${id}`, APPOINTMENT: (id) => `/appointments/${id}` };

/** Medical record entry details (PrimeNG). Event-built entries are read-only; manual entries can be edited (Reactive Form). rxResource loads the entry. */
@Component({
  selector: 'app-record-entry',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, ButtonModule, InputTextModule, TextareaModule, TagModule, SkeletonModule, PageHeaderComponent, ErrorStateComponent, RecordDatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mx-auto max-w-3xl">
      @if (entry.isLoading()) { <p-skeleton height="8rem" /> }
      @else if (entry.error()) { <app-error-state [error]="entry.error()" (retry)="entry.reload()" /> }
      @else if (entry.value()) {
        @let e = entry.value()!;
        <app-page-header [title]="e.title" [subtitle]="label(e.entryType) + ' · ' + (e.recordedAt | recordDate)">
          <p-button actions label="Back to record" severity="secondary" (onClick)="back(e.patientId)" />
          @if (editable()) { <p-button actions label="Edit" icon="pi pi-pencil" (onClick)="editing.set(true)" /> }
        </app-page-header>
        <section class="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
          @if (editing()) {
            <form [formGroup]="form" (ngSubmit)="save(e.id)" class="grid gap-3" novalidate aria-label="Edit entry">
              @if (error()) { <p role="alert" class="text-sm text-red-700">{{ error() }}</p> }
              <label class="text-sm font-medium">Title<input pInputText formControlName="title" class="mt-1 w-full" maxlength="200" /></label>
              <label class="text-sm font-medium">Details<textarea pTextarea formControlName="details" rows="5" class="mt-1 w-full" maxlength="4000"></textarea></label>
              <div class="flex justify-end gap-2"><p-button type="button" label="Cancel" severity="secondary" (onClick)="editing.set(false)" /><p-button type="submit" label="Save" [loading]="busy()" /></div>
            </form>
          } @else { <p class="whitespace-pre-line text-sm">{{ e.details ?? 'No details recorded.' }}</p> }
          @if (!editable() && !editing()) { <p class="mt-3 text-xs text-slate-500">{{ e.source === 'EVENT' ? 'Created automatically from a clinical event – read-only.' : 'You do not have permission to edit entries.' }}</p> }
        </section>
        <section class="mt-4 rounded-xl border border-slate-200 bg-white p-5 text-sm dark:border-slate-700 dark:bg-slate-900"><h3 class="mb-3 font-semibold">Entry information</h3>
          <dl class="grid gap-3 sm:grid-cols-3"><div><dt class="text-xs uppercase text-slate-500">Entry id</dt><dd>#{{ e.id }}</dd></div><div><dt class="text-xs uppercase text-slate-500">Patient</dt><dd><a [routerLink]="['/patients', e.patientId]" class="text-brand-600">#{{ e.patientId }}</a></dd></div><div><dt class="text-xs uppercase text-slate-500">Source</dt><dd><p-tag [value]="e.source" [severity]="e.source === 'EVENT' ? 'info' : 'secondary'" /></dd></div></dl>
          @if (refLink(e); as l) { <p class="mt-3">Generated from {{ label(e.referenceType ?? '') }} #{{ e.referenceId }}. <a [routerLink]="l" class="font-semibold text-brand-600">Open it</a></p> }</section>
      }
    </div>`,
})
export class RecordEntryComponent {
  readonly entryId = input.required<string>();
  private readonly api = inject(MedicalRecordApiService);
  private readonly auth = inject(AuthService);
  private readonly notify = inject(NotificationService);
  private readonly router = inject(Router);
  protected readonly entry = rxResource({ request: () => Number(this.entryId()), loader: ({ request }) => this.api.entry(request) });
  protected readonly editing = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly editable = computed(() => this.auth.can('records:write') && this.entry.value()?.source === 'MANUAL');
  protected readonly label = humanize;
  protected readonly form = inject(NonNullableFormBuilder).group({ title: ['', [Validators.required, Validators.maxLength(200)]], details: [''] });
  constructor() { effect(() => { const e = this.entry.value(); if (e) this.form.reset({ title: e.title, details: e.details ?? '' }); }); }
  protected refLink(e: { referenceType: string | null; referenceId: number | null }) { return e.referenceType && e.referenceId ? REF_ROUTE[e.referenceType]?.(e.referenceId) : undefined; }
  protected back(patientId: number) { void this.router.navigate(['/records/patients', patientId]); }
  protected save(id: number) {
    if (this.form.invalid) return;
    this.busy.set(true); this.error.set(null);
    const v = this.form.getRawValue();
    this.api.updateEntry(id, { title: v.title.trim(), details: v.details.trim() || null }).subscribe({ next: () => { this.busy.set(false); this.editing.set(false); this.notify.success('Entry updated'); this.entry.reload(); }, error: (e: unknown) => { this.busy.set(false); this.error.set(ApiError.from(e).message); } });
  }
}
