import { HttpEventType, HttpProgressEvent } from '@angular/common/http';
import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { InputTextModule } from 'primeng/inputtext';
import { ProgressBarModule } from 'primeng/progressbar';
import { TagModule } from 'primeng/tag';
import { TextareaModule } from 'primeng/textarea';
import { BehaviorSubject, Observable, catchError, of, switchMap } from 'rxjs';
import { LaboratoryApiService } from '../../core/api/laboratory-api.service';
import { AuthService } from '../../core/auth/auth.service';
import type { LabReport, LabRequest, LabStatus } from '../../core/models';
import type { LoadState } from '../../core/models/api-error';
import { FileService } from '../../core/services/file.service';
import { NotificationService } from '../../core/services/notification.service';
import { ConfirmService } from '../../shared/components/confirm-dialog.component';
import { DataStateComponent, FileDropzoneComponent, PageHeaderComponent } from '../../shared/components';
import { emptyToNull } from '../../shared/utilities/helpers';
import { toLoadState } from '../../shared/utilities/load-state';
import { sevOfPriority, sevOfStatus } from './lab-requests.component';

const NEXT: Partial<Record<LabStatus, LabStatus>> = { REQUESTED: 'SAMPLE_COLLECTED', SAMPLE_COLLECTED: 'IN_PROGRESS' };

/** Lab request details: status progression (LAB_STAFF), report entry, attachment upload (progress) and download (blob). */
@Component({
  selector: 'app-lab-request-details',
  standalone: true,
  imports: [DatePipe, DecimalPipe, FormsModule, ReactiveFormsModule, RouterLink, ButtonModule, CheckboxModule, InputTextModule, ProgressBarModule, TagModule, TextareaModule, PageHeaderComponent, DataStateComponent, FileDropzoneComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mx-auto max-w-3xl space-y-4">
      <app-page-header title="Lab request" [subtitle]="'#' + id()"><a actions routerLink="/laboratory/requests"><p-button label="Back" severity="secondary" [text]="true" /></a></app-page-header>
      <app-data-state [state]="state()" (retry)="reload$.next()">
        <ng-template #loaded let-r>
          <section class="space-y-2 rounded-xl border border-slate-200 bg-white p-5 text-sm dark:border-slate-700 dark:bg-slate-900">
            <div class="flex flex-wrap items-center justify-between gap-2"><h2 class="text-lg font-semibold">{{ r.testName }} <span class="text-slate-500">({{ r.testCode }})</span></h2><span class="flex gap-1"><p-tag [value]="r.priority" [severity]="prio(r.priority)" /><p-tag [value]="r.status" [severity]="sev(r.status)" /></span></div>
            <dl class="grid gap-2 sm:grid-cols-3"><div><dt class="text-xs text-slate-500">Patient</dt><dd><a [routerLink]="['/patients', r.patientId]">{{ r.patientName }}</a></dd></div><div><dt class="text-xs text-slate-500">Accession</dt><dd>{{ r.accessionNumber ?? 'assigning…' }}</dd></div><div><dt class="text-xs text-slate-500">Requested</dt><dd>{{ r.requestedAt | date: 'dd MMM yyyy HH:mm' }}</dd></div></dl>
            @if (r.clinicalNotes) { <p><b>Clinical notes:</b> {{ r.clinicalNotes }}</p> }
            <div class="flex flex-wrap gap-2 pt-2">
              @if (auth.can('lab:process') && next(r)) { <p-button [label]="'Mark ' + next(r)!.replace('_', ' ').toLowerCase()" [loading]="busy()" (onClick)="advance(r)" /> }
              @if (canCancel(r)) { <p-button label="Cancel request" severity="danger" [outlined]="true" [loading]="busy()" (onClick)="cancel(r)" /> }
            </div>
          </section>
          @if (reportState(); as rs) {
            @switch (rs.status) {
              @case ('loaded') { @if (rs.data; as rep) {
                <section class="mt-4 space-y-2 rounded-xl border border-slate-200 bg-white p-5 text-sm dark:border-slate-700 dark:bg-slate-900"><h2 class="font-semibold">Report</h2>
                  <p [class]="rep.abnormal ? 'font-semibold text-red-700' : ''">{{ rep.resultSummary }} @if (rep.abnormal) { <p-tag value="ABNORMAL" severity="danger" /> }</p>
                  @if (rep.resultDetails) { <pre class="whitespace-pre-wrap rounded bg-slate-50 p-3 dark:bg-slate-800">{{ rep.resultDetails }}</pre> }
                  <p class="text-slate-500">Reference range: {{ rep.referenceRange ?? '—' }} · reported by {{ rep.reportedBy }} on {{ rep.reportedAt | date: 'dd MMM yyyy HH:mm' }}</p>
                  @if (rep.attachment) { <p><i class="pi pi-paperclip"></i> {{ rep.attachment.name }} ({{ rep.attachment.sizeBytes / 1024 | number: '1.0-0' }} KB) <p-button label="Download" size="small" [outlined]="true" (onClick)="download(r.id)" /></p> }
                  @if (auth.can('lab:process')) { <div class="border-t pt-3"><app-file-dropzone (fileSelected)="file.set($event)" />@if (file()) { <p-button class="mt-2 inline-block" label="Upload attachment" (onClick)="upload(r.id)" [disabled]="progress() !== null" /> }@if (progress() !== null) { <p-progressbar [value]="progress()!" styleClass="mt-2" /> }</div> }
                </section> } @else {
                  @if (auth.can('lab:process') && r.status !== 'CANCELLED') {
                    <section class="mt-4 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900"><h2 class="mb-2 font-semibold">Enter report</h2>
                      <form [formGroup]="reportForm" (ngSubmit)="submitReport(r.id)" class="space-y-3" novalidate>
                        <input pInputText class="w-full" formControlName="resultSummary" placeholder="Result summary" aria-label="Result summary" />
                        @if (reportForm.controls.resultSummary.touched && reportForm.controls.resultSummary.invalid) { <p class="text-xs text-red-600">Result summary is required</p> }
                        <textarea pTextarea rows="3" class="w-full" formControlName="resultDetails" placeholder="Details" aria-label="Result details"></textarea>
                        <input pInputText class="w-full" formControlName="referenceRange" placeholder="Reference range" aria-label="Reference range" />
                        <label class="flex items-center gap-2 text-sm"><p-checkbox formControlName="abnormal" [binary]="true" inputId="abn" /> Abnormal result</label>
                        <p-button type="submit" label="Submit report" [loading]="busy()" /></form></section>
                  } @else { <p class="mt-4 text-sm text-slate-500">No report yet.</p> }
              } }
              @case ('error') { <p class="mt-4 text-sm text-red-700">Could not load the report.</p> }
            }
          }
        </ng-template>
      </app-data-state>
    </div>`,
})
export class LabRequestDetailsComponent {
  readonly id = input.required<string>();
  protected readonly auth = inject(AuthService);
  private readonly api = inject(LaboratoryApiService);
  private readonly files = inject(FileService);
  private readonly notify = inject(NotificationService);
  private readonly confirm = inject(ConfirmService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly sev = sevOfStatus;
  protected readonly prio = sevOfPriority;
  protected readonly reload$ = new BehaviorSubject<void>(undefined);
  protected readonly busy = signal(false);
  protected readonly file = signal<File | null>(null);
  protected readonly progress = signal<number | null>(null);
  private readonly id$ = toObservable(computed(() => Number(this.id())));
  protected readonly state = toSignal(this.reload$.pipe(switchMap(() => this.id$), switchMap((id) => toLoadState(this.api.request(id)))), { initialValue: { status: 'loading' } as LoadState<LabRequest> });
  /** The report exists only once the request is COMPLETED, so it is fetched then (no probing 404); loaded `null` = no report yet. */
  protected readonly reportState = toSignal(
    toObservable(this.state).pipe(
      switchMap((s): Observable<LoadState<LabReport | null>> => (s.status !== 'loaded' ? of({ status: 'loading' }) : s.data.status === 'COMPLETED' ? toLoadState<LabReport | null>(this.api.report(s.data.id)) : of({ status: 'loaded', data: null }))),
    ), { initialValue: { status: 'loading' } as LoadState<LabReport | null> });
  protected readonly reportForm = this.fb.group({ resultSummary: ['', [Validators.required, Validators.maxLength(500)]], resultDetails: [''], referenceRange: [''], abnormal: [false] });

  protected next(r: LabRequest) { return NEXT[r.status]; }
  protected canCancel(r: LabRequest) { return (r.status === 'REQUESTED' || r.status === 'SAMPLE_COLLECTED') && (this.auth.can('lab:request') || this.auth.can('lab:process')); }
  private run<T>(obs: import('rxjs').Observable<T>, done: string) {
    this.busy.set(true);
    obs.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: () => { this.busy.set(false); this.notify.success(done); this.reload$.next(); }, error: () => this.busy.set(false) });
  }
  protected advance(r: LabRequest) { const n = NEXT[r.status]; if (n) this.run(this.api.setStatus(r.id, n), 'Status updated'); }
  protected cancel(r: LabRequest) {
    this.confirm.confirm({ title: 'Cancel lab request?', message: `Request #${r.id} (${r.testName}) will be cancelled.`, confirmLabel: 'Cancel request', destructive: true }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe((c) => { if (c.confirmed) this.run(this.api.cancel(r.id), 'Request cancelled'); });
  }
  protected submitReport(id: number) {
    this.reportForm.markAllAsTouched(); if (this.reportForm.invalid) return;
    const v = this.reportForm.getRawValue();
    this.run(this.api.submitReport(id, { resultSummary: v.resultSummary.trim(), resultDetails: emptyToNull(v.resultDetails), referenceRange: emptyToNull(v.referenceRange), abnormal: v.abnormal }), 'Report submitted');
  }
  protected upload(id: number) {
    const f = this.file(); if (!f) return;
    this.progress.set(0);
    this.api.uploadAttachment(id, f).pipe(takeUntilDestroyed(this.destroyRef), catchError((e) => { this.progress.set(null); throw e; })).subscribe({
      next: (ev) => { if (ev.type === HttpEventType.UploadProgress) { const p = ev as HttpProgressEvent; this.progress.set(p.total ? Math.round((100 * p.loaded) / p.total) : 0); } if (ev.type === HttpEventType.Response) { this.progress.set(null); this.file.set(null); this.notify.success('Attachment uploaded'); this.reload$.next(); } },
      error: () => this.progress.set(null),
    });
  }
  protected download(id: number) { this.api.downloadAttachment(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe((res) => this.files.save(res.body as Blob, this.files.fileNameOf(res, `lab-report-${id}`))); }
}
