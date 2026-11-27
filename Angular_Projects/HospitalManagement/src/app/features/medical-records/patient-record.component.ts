import { ScrollingModule } from '@angular/cdk/scrolling';

import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { rxResource, toObservable, toSignal, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { SkeletonModule } from 'primeng/skeleton';
import { TableLazyLoadEvent, TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TextareaModule } from 'primeng/textarea';
import { debounceTime, distinctUntilChanged, map, switchMap, tap } from 'rxjs';
import { MedicalRecordApiService } from '../../core/api/medical-record-api.service';
import { PatientApiService } from '../../core/api/patient-api.service';
import { AuthService } from '../../core/auth/auth.service';
import { RECORD_ENTRY_TYPES, type RecordEntry, type RecordEntryType } from '../../core/models';
import { ApiError } from '../../core/models/api-error';
import { NotificationService } from '../../core/services/notification.service';
import { EmptyStateComponent, ErrorStateComponent, PageHeaderComponent } from '../../shared/components';
import { HasPermissionDirective } from '../../shared/directives/directives';
import { PatientNamePipe, RecordDatePipe } from '../../shared/pipes/pipes';
import { CurrentIdentityService } from '../../core/services/current-identity.service';
import { humanize } from '../../shared/utilities/helpers';

/**
 * Patient medical record (PrimeNG).
 *  - summary: `rxResource()` – signal-based async loading from an Observable (request = patientId signal; reloads when it changes, `.reload()` after edits)
 *  - entries: PrimeNG lazy `p-table` – server-side paging + type filtering + (debounced) client search of the page; HttpParams carry page/size/type
 *  - timeline: `@defer (on viewport)` block with CDK virtual scrolling (only visible rows are rendered)
 *  - custom pipe `recordDate`, PrimeNG dialog + Reactive Form to add entries
 */
@Component({
  selector: 'app-patient-record',
  standalone: true,
  imports: [FormsModule, ReactiveFormsModule, RouterLink, ScrollingModule, TableModule, ButtonModule, DialogModule, InputTextModule, SelectModule, TagModule, SkeletonModule, TextareaModule, PageHeaderComponent, ErrorStateComponent, EmptyStateComponent, HasPermissionDirective, RecordDatePipe, PatientNamePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header [title]="(patient.value() | patientName) + ' — medical record'" [subtitle]="'Patient #' + patientId()">
      <a actions [routerLink]="['/records/documents']" [queryParams]="{ patientId: patientId() }" class="rounded-md border border-slate-300 px-3 py-2 text-sm no-underline dark:border-slate-600">Documents</a>
      <p-button actions *appHasPermission="'records:write'" label="Add entry" icon="pi pi-plus" (onClick)="dialog.set(true)" />
    </app-page-header>

    <section class="mb-4 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900" aria-label="Summary">
      @if (summary.isLoading()) { <p-skeleton height="4rem" /> }
      @else if (summary.error()) { <app-error-state [error]="summary.error()" (retry)="summary.reload()" /> }
      @else if (summary.value()) {
        @let s = summary.value()!;
        <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">@for (t of types; track t) { <div class="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800"><div class="text-2xl font-bold">{{ s.entryCounts[t] ?? 0 }}</div><div class="text-[11px] uppercase tracking-wide text-slate-500">{{ label(t) }}</div></div> }</div>
        <div class="mt-3 flex items-start justify-between gap-3 text-sm"><p><b>Chronic conditions:</b> {{ s.chronicConditions ?? 'none recorded' }}</p>
          <p-button *appHasPermission="'records:write'" icon="pi pi-pencil" [text]="true" size="small" ariaLabel="Edit chronic conditions" (onClick)="editConditions(s.chronicConditions)" /></div>
      }
    </section>

    <section class="mb-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900" aria-label="Entries">
      <div class="mb-3 flex flex-wrap items-center gap-3">
        <p-select [options]="typeOptions" [ngModel]="type()" (ngModelChange)="onType($event)" optionLabel="label" optionValue="value" placeholder="All entry types" [showClear]="true" ariaLabel="Entry type" styleClass="w-56" />
        <input pInputText class="w-64" placeholder="Search this page…" aria-label="Search entries" [ngModel]="search()" (ngModelChange)="search.set($event)" />
        <span class="text-sm text-slate-500">{{ total() }} entries</span>
      </div>
      <p-table [value]="rows()" [lazy]="true" (onLazyLoad)="lazy($event)" [paginator]="true" [rows]="10" [totalRecords]="total()" [loading]="loading()" [rowsPerPageOptions]="[10, 25, 50]" dataKey="id" aria-label="Medical record entries" [tableStyle]="{ 'min-width': '40rem' }">
        <ng-template pTemplate="header"><tr><th>Recorded</th><th>Type</th><th>Title</th><th>Source</th><th></th></tr></ng-template>
        <ng-template pTemplate="body" let-e><tr><td>{{ e.recordedAt | recordDate }}</td><td><p-tag [value]="label(e.entryType)" [severity]="severity(e.entryType)" /></td><td><a [routerLink]="['/records/entries', e.id]" class="font-semibold text-brand-600">{{ e.title }}</a></td><td>{{ e.source === 'EVENT' ? 'automatic' : 'manual' }}</td><td class="text-right"><a [routerLink]="['/records/entries', e.id]" class="text-sm">Open</a></td></tr></ng-template>
        <ng-template pTemplate="emptymessage"><tr><td colspan="5"><app-empty-state title="No entries" description="Nothing matches the chosen type or search." /></td></tr></ng-template>
      </p-table>
    </section>

    @defer (on viewport) {
      <section class="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900" aria-label="Timeline">
        <h2 class="mb-3 font-semibold">Timeline (virtual scrolling)</h2>
        <cdk-virtual-scroll-viewport itemSize="72" class="h-72 rounded-lg border border-slate-100 dark:border-slate-700">
          <div *cdkVirtualFor="let e of timeline(); trackBy: trackById" class="flex h-[72px] items-start gap-3 border-b border-slate-100 px-3 py-2 text-sm dark:border-slate-800">
            <p-tag [value]="label(e.entryType)" [severity]="severity(e.entryType)" /><div class="min-w-0"><a [routerLink]="['/records/entries', e.id]" class="block truncate font-semibold text-brand-600">{{ e.title }}</a><span class="text-xs text-slate-500">{{ e.recordedAt | recordDate }}</span><span class="block truncate text-xs text-slate-500">{{ e.details }}</span></div></div>
        </cdk-virtual-scroll-viewport>
      </section>
    } @placeholder { <div class="h-72 rounded-xl bg-slate-100 dark:bg-slate-800"></div> } @loading (minimum 300ms) { <p-skeleton height="18rem" /> }

    <p-dialog header="Add clinical entry" [(visible)]="dialog" [modal]="true" [style]="{ width: '30rem' }" [draggable]="false">
      <form [formGroup]="entryForm" (ngSubmit)="addEntry()" class="grid gap-3" novalidate aria-label="New entry form">
        <label class="text-sm font-medium">Type<select formControlName="entryType" class="mt-1 block w-full rounded-md border border-slate-300 bg-transparent p-2 text-inherit dark:border-slate-600">@for (t of writableTypes; track t) { <option [value]="t">{{ label(t) }}</option> }</select></label>
        <label class="text-sm font-medium">Title<input pInputText formControlName="title" class="mt-1 w-full" maxlength="200" />@if (entryForm.controls.title.touched && entryForm.controls.title.invalid) { <small class="text-red-600">Title is required</small> }</label>
        <label class="text-sm font-medium">Details<textarea pTextarea formControlName="details" rows="4" class="mt-1 w-full" maxlength="4000"></textarea></label>
        @if (formError()) { <p role="alert" class="text-sm text-red-700">{{ formError() }}</p> }
        <div class="flex justify-end gap-2"><p-button type="button" label="Cancel" severity="secondary" (onClick)="dialog.set(false)" /><p-button type="submit" label="Add entry" [loading]="saving()" /></div>
      </form>
    </p-dialog>`,
})
export class PatientRecordComponent {
  readonly patientId = input.required<string>();
  private readonly api = inject(MedicalRecordApiService);
  private readonly patients = inject(PatientApiService);
  private readonly notify = inject(NotificationService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly doctor = toSignal(inject(CurrentIdentityService).doctor$);
  protected readonly auth = inject(AuthService);
  private readonly id = computed(() => Number(this.patientId()));

  protected readonly types = RECORD_ENTRY_TYPES;
  protected readonly writableTypes = RECORD_ENTRY_TYPES.filter((t) => t !== 'LAB_REPORT' && t !== 'PRESCRIPTION');
  protected readonly typeOptions = RECORD_ENTRY_TYPES.map((t) => ({ label: humanize(t), value: t }));
  protected readonly label = humanize;
  protected readonly trackById = (_: number, e: RecordEntry) => e.id;

  /** rxResource: Observable-based loader driven by a signal request. */
  protected readonly summary = rxResource({ request: () => this.id(), loader: ({ request }) => this.api.summary(request) });
  protected readonly patient = rxResource({ request: () => this.id(), loader: ({ request }) => this.patients.getById(request).pipe(map((p) => p as { firstName: string; lastName: string } | null)) });

  protected readonly type = signal<RecordEntryType | null>(null);
  protected readonly search = signal('');
  protected readonly loading = signal(false);
  protected readonly total = signal(0);
  private readonly page = signal({ page: 0, size: 10 });
  private readonly pageRows = signal<RecordEntry[]>([]);
  protected readonly rows = computed(() => { const q = this.search().trim().toLowerCase(); return this.pageRows().filter((e) => !q || e.title.toLowerCase().includes(q) || (e.details ?? '').toLowerCase().includes(q)); });
  /** Timeline: the same entries as a big list for virtual scroll (first 100). */
  protected readonly timeline = signal<RecordEntry[]>([]);

  private readonly load$ = toObservable(computed(() => ({ id: this.id(), type: this.type(), ...this.page() }))).pipe(
    debounceTime(0), distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b)),
    tap(() => this.loading.set(true)),
    switchMap((q) => this.api.entries(q.id, { type: q.type ?? undefined, page: q.page, size: q.size })),
    takeUntilDestroyed(),
  );
  constructor() {
    this.load$.subscribe({ next: (p) => { this.pageRows.set(p.content); this.total.set(p.totalElements); this.loading.set(false); }, error: () => this.loading.set(false) });
    toObservable(computed(() => [this.id(), this.type()] as const)).pipe(switchMap(([id, t]) => this.api.entries(id, { type: t ?? undefined, page: 0, size: 100 })), takeUntilDestroyed()).subscribe((p) => this.timeline.set(p.content));
  }
  protected lazy(e: TableLazyLoadEvent) { const size = e.rows ?? 10; this.page.set({ page: Math.floor((e.first ?? 0) / size), size }); }
  protected onType(t: RecordEntryType | null) { this.type.set(t); this.page.set({ page: 0, size: this.page().size }); }
  protected severity(t: RecordEntryType): 'info' | 'success' | 'warn' | 'danger' | 'secondary' | 'contrast' { return ({ DIAGNOSIS: 'danger', VISIT: 'info', LAB_REPORT: 'contrast', PRESCRIPTION: 'success', ALLERGY: 'warn', NOTE: 'secondary' } as const)[t]; }

  // ---- add entry dialog (Reactive Form)
  protected readonly dialog = signal(false);
  protected readonly saving = signal(false);
  protected readonly formError = signal<string | null>(null);
  protected readonly entryForm = this.fb.group({ entryType: this.fb.control<RecordEntryType>('NOTE'), title: ['', [Validators.required, Validators.maxLength(200)]], details: ['', Validators.maxLength(4000)] });
  protected addEntry() {
    if (this.entryForm.invalid) { this.entryForm.markAllAsTouched(); return; }
    const v = this.entryForm.getRawValue();
    this.saving.set(true); this.formError.set(null);
    this.api.createEntry({ patientId: this.id(), entryType: v.entryType, title: v.title.trim(), details: v.details.trim() || null, doctorId: this.doctor()?.id ?? null }).subscribe({
      next: () => { this.saving.set(false); this.dialog.set(false); this.entryForm.reset({ entryType: 'NOTE', title: '', details: '' }); this.notify.success('Entry added to the record'); this.summary.reload(); this.page.set({ ...this.page() }); this.refetchPage(); },
      error: (e: unknown) => { this.saving.set(false); this.formError.set(ApiError.from(e).message); },
    });
  }
  private refetchPage() { this.api.entries(this.id(), { type: this.type() ?? undefined, page: this.page().page, size: this.page().size }).subscribe((p) => { this.pageRows.set(p.content); this.total.set(p.totalElements); }); this.api.entries(this.id(), { page: 0, size: 100 }).subscribe((p) => this.timeline.set(p.content)); }
  protected editConditions(current: string | null) {
    const next = window.prompt('Chronic conditions (max 500 characters)', current ?? '');
    if (next === null) return;
    this.api.setConditions(this.id(), next.trim() || null).subscribe(() => { this.notify.success('Chronic conditions saved'); this.summary.reload(); });
  }
}
