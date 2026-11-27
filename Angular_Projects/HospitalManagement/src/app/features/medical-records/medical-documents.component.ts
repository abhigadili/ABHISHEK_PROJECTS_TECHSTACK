import { HttpEventType, HttpProgressEvent } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal, viewChild } from '@angular/core';
import { rxResource, takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { ProgressBarModule } from 'primeng/progressbar';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { catchError, forkJoin, map, of, switchMap } from 'rxjs';
import { LaboratoryApiService } from '../../core/api/laboratory-api.service';
import { MedicalRecordApiService } from '../../core/api/medical-record-api.service';
import { AuthService } from '../../core/auth/auth.service';
import type { LabReport, LabRequest, Patient } from '../../core/models';
import { CurrentIdentityService } from '../../core/services/current-identity.service';
import { FileService } from '../../core/services/file.service';
import { NotificationService } from '../../core/services/notification.service';
import { ErrorStateComponent, FileDropzoneComponent, NoticeComponent, PageHeaderComponent, PatientPickerComponent } from '../../shared/components';
import { RecordDatePipe } from '../../shared/pipes/pipes';
import { toObservable } from '@angular/core/rxjs-interop';

/**
 * Medical documents (PrimeNG). The backend stores one kind of document: the PDF/PNG/JPEG attached to a LAB REPORT.
 *  - download: `responseType: 'blob'` + `observe: 'response'` → file name from Content-Disposition → FileService.save
 *  - upload  : `observe: 'events'` + `reportProgress` → UploadProgress events drive a PrimeNG progress bar (HttpEventType.UploadProgress)
 */
@Component({
  selector: 'app-medical-documents',
  standalone: true,
  imports: [ButtonModule, ProgressBarModule, TableModule, TagModule, PageHeaderComponent, PatientPickerComponent, FileDropzoneComponent, NoticeComponent, ErrorStateComponent, RecordDatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header title="Medical documents" subtitle="Report attachments stored with lab reports" />
    @if (auth.role() !== 'PATIENT') { <div class="mb-4 max-w-md"><app-patient-picker [(patient)]="picked" /></div> }
    @if (patientId() === 0) { <app-notice heading="Select a patient">Choose a patient to list their documents.</app-notice> }
    @else if (requests.error()) { <app-error-state [error]="requests.error()" (retry)="requests.reload()" /> }
    @else {
      <p-table [value]="requests.value() ?? []" [loading]="requests.isLoading()" aria-label="Documents" dataKey="id">
        <ng-template pTemplate="header"><tr><th>Test</th><th>Requested</th><th>Status</th><th>Document</th><th class="text-right">Actions</th></tr></ng-template>
        <ng-template pTemplate="body" let-r><tr><td><b>{{ r.testName }}</b><div class="text-xs text-slate-500">{{ r.accessionNumber ?? 'accession pending' }}</div></td><td>{{ r.requestedAt | recordDate }}</td><td><p-tag [value]="r.status" [severity]="r.status === 'COMPLETED' ? 'success' : 'info'" /></td>
          <td class="text-sm">@if (reports()[r.id]; as rep) { @if (rep.attachment) { {{ rep.attachment.name }} <span class="text-slate-500">· {{ (rep.attachment.sizeBytes / 1024).toFixed(1) }} KB</span> } @else { <span class="text-slate-500">No attachment on this report</span> } } @else { <span class="text-slate-500">{{ r.status === 'COMPLETED' ? 'Checking…' : 'Report not ready' }}</span> }</td>
          <td class="text-right">@if (reports()[r.id]?.attachment) { <p-button size="small" icon="pi pi-download" label="Download" [loading]="busyId() === r.id" (onClick)="download(r, reports()[r.id]!)" /> }
            @if (auth.can('lab:process') && reports()[r.id]) { <p-button size="small" severity="secondary" icon="pi pi-upload" [label]="reports()[r.id]!.attachment ? 'Replace' : 'Upload'" (onClick)="uploadFor.set(uploadFor() === r.id ? null : r.id)" class="ml-2" /> }</td></tr>
          @if (uploadFor() === r.id) { <tr><td colspan="5"><app-file-dropzone (fileSelected)="file.set($event)" />@if (progress() !== null) { <p-progressbar [value]="progress()!" class="mt-2" /> }<div class="mt-2 text-right"><p-button label="Upload document" [disabled]="!file() || progress() !== null" (onClick)="upload(r)" /></div></td></tr> }
        </ng-template>
        <ng-template pTemplate="emptymessage"><tr><td colspan="5" class="p-6 text-center text-slate-500">No lab requests – documents appear when a lab report has an attachment.</td></tr></ng-template>
      </p-table>
    }`,
})
export class MedicalDocumentsComponent {
  protected readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly lab = inject(LaboratoryApiService);
  private readonly records = inject(MedicalRecordApiService);
  private readonly files = inject(FileService);
  private readonly notify = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly own = toSignal(inject(CurrentIdentityService).patient$);
  protected readonly picked = signal<Patient | null>(null);
  private readonly urlId = Number(this.route.snapshot.queryParamMap.get('patientId')) || 0;
  protected readonly patientId = computed(() => (this.auth.role() === 'PATIENT' ? (this.own()?.id ?? 0) : (this.picked()?.id ?? this.urlId)));
  protected readonly requests = rxResource({ request: () => this.patientId(), loader: ({ request }) => (request > 0 ? this.lab.requestsForPatient(request) : of([] as LabRequest[])) });
  /** forkJoin: the reports of all completed requests are loaded in parallel and merged into an id → report map (failures → skipped). */
  protected readonly reports = toSignal(
    toObservable(computed(() => this.requests.value() ?? [])).pipe(
      switchMap((list) => {
        const done = list.filter((r) => r.status === 'COMPLETED');
        if (!done.length) return of({} as Record<number, LabReport>);
        return forkJoin(done.map((r) => this.lab.report(r.id).pipe(map((rep) => [r.id, rep] as const), catchError(() => of(null))))).pipe(
          map((pairs) => Object.fromEntries(pairs.filter((x): x is readonly [number, LabReport] => !!x)) as Record<number, LabReport>),
        );
      }),
    ),
    { initialValue: {} as Record<number, LabReport> },
  );
  protected readonly busyId = signal<number | null>(null);
  protected readonly uploadFor = signal<number | null>(null);
  protected readonly file = signal<File | null>(null);
  protected readonly progress = signal<number | null>(null);
  private readonly dropzone = viewChild(FileDropzoneComponent);

  protected download(r: LabRequest, rep: LabReport) {
    this.busyId.set(r.id);
    this.records.downloadDocument(r.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => { this.busyId.set(null); this.files.save(res.body as Blob, rep.attachment?.name ?? this.files.fileNameOf(res)); this.notify.success(`Downloaded ${rep.attachment?.name ?? 'document'}`); },
      error: () => this.busyId.set(null),
    });
  }
  protected upload(r: LabRequest) {
    const f = this.file();
    if (!f) return;
    this.progress.set(0);
    this.records.uploadDocument(r.id, f).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (ev) => { if (ev.type === HttpEventType.UploadProgress) { const p = ev as HttpProgressEvent; this.progress.set(p.total ? Math.round((100 * p.loaded) / p.total) : 0); } if (ev.type === HttpEventType.Response) { this.progress.set(null); this.uploadFor.set(null); this.file.set(null); this.dropzone()?.clear(); this.notify.success('Document uploaded'); this.requests.reload(); } },
      error: () => this.progress.set(null),
    });
  }
}
