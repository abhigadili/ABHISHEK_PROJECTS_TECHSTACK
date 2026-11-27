import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { TableLazyLoadEvent, TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { BehaviorSubject, combineLatest, debounceTime, map, of, switchMap } from 'rxjs';
import { LaboratoryApiService } from '../../core/api/laboratory-api.service';
import { AuthService } from '../../core/auth/auth.service';
import type { LabPriority, LabRequest, LabStatus, Page, Patient } from '../../core/models';
import type { LoadState } from '../../core/models/api-error';
import { CurrentIdentityService } from '../../core/services/current-identity.service';
import { DataStateComponent, NoticeComponent, PageHeaderComponent, PatientPickerComponent } from '../../shared/components';
import { toLoadState } from '../../shared/utilities/load-state';

export const LAB_STATUSES: LabStatus[] = ['REQUESTED', 'SAMPLE_COLLECTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
export const sevOfStatus = (s: LabStatus) => ({ REQUESTED: 'info', SAMPLE_COLLECTED: 'warn', IN_PROGRESS: 'warn', COMPLETED: 'success', CANCELLED: 'secondary' } as const)[s];
export const sevOfPriority = (p: LabPriority) => ({ ROUTINE: 'secondary', URGENT: 'warn', STAT: 'danger' } as const)[p];
type Row = { rows: LabRequest[]; total: number };

/**
 * Lab requests. STAFF (ADMIN/DOCTOR/LAB_STAFF): server-paged list with status filter (p-table lazy → GET /lab/requests?page&size&status).
 * PATIENT: own requests (GET /lab/requests/patient/{id}) – the staff list is 403 for patients. The same component doubles as the per-patient
 * HISTORY page (`mode = history` route data): staff pick a patient.
 */
@Component({
  selector: 'app-lab-requests',
  standalone: true,
  imports: [FormsModule, DatePipe, RouterLink, ButtonModule, SelectModule, TableModule, TagModule, PageHeaderComponent, DataStateComponent, PatientPickerComponent, NoticeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header [title]="history ? 'Lab history' : 'Lab requests'" [subtitle]="isPatient() ? 'Your lab requests' : history ? 'Requests for a patient' : 'All requests'">
      @if (auth.can('lab:request')) { <a actions routerLink="/laboratory/requests/new"><p-button label="New lab request" icon="pi pi-plus" /></a> }
    </app-page-header>
    @if (isPatient() && ownMissing()) { <app-notice tone="warning" heading="No patient profile">Create your patient profile to see lab requests.</app-notice> }
    @else {
      @if (!isPatient() && history) { <div class="mb-3 max-w-xl"><app-patient-picker [(patient)]="picked" /></div> }
      @if (!isPatient() && !history) {
        <div class="mb-3 flex items-center gap-2"><p-select [options]="statusOptions" [ngModel]="status()" (ngModelChange)="setStatus($event)" optionLabel="label" optionValue="value" placeholder="All statuses" [showClear]="true" ariaLabel="Status filter" /></div> }
      @if (mode() === 'none') { <p class="text-sm text-slate-500">Select a patient to see their lab history.</p> }
      @else {
        <app-data-state [state]="state()" emptyTitle="No lab requests" (retry)="reload$.next()">
          <ng-template #loaded let-d>
            <p-table [value]="d.rows" [lazy]="mode() === 'staff'" [paginator]="mode() === 'staff' ? d.total > size : d.rows.length > 10" [rows]="mode() === 'staff' ? size : 10" [totalRecords]="d.total" [first]="page() * size" (onLazyLoad)="lazy($event)" [lazyLoadOnInit]="false" styleClass="p-datatable-sm">
              <ng-template #header><tr><th>#</th><th>Accession</th><th>Patient</th><th>Test</th><th>Priority</th><th>Status</th><th>Requested</th><th></th></tr></ng-template>
              <ng-template #body let-r><tr><td>{{ r.id }}</td><td>{{ r.accessionNumber ?? '—' }}</td><td>{{ r.patientName }}</td><td>{{ r.testName }}</td><td><p-tag [value]="r.priority" [severity]="prio(r.priority)" /></td><td><p-tag [value]="r.status" [severity]="sev(r.status)" /></td><td>{{ r.requestedAt | date: 'dd MMM yyyy HH:mm' }}</td><td><a [routerLink]="['/laboratory/requests', r.id]">Open</a></td></tr></ng-template>
            </p-table>
          </ng-template>
        </app-data-state>
      }
    }`,
})
export class LabRequestsComponent {
  /** Route data `{ view: 'history' }` is bound to this input (withComponentInputBinding). */
  readonly view = input<'list' | 'history'>('list');
  protected readonly auth = inject(AuthService);
  private readonly api = inject(LaboratoryApiService);
  private readonly ownPatient = toSignal(inject(CurrentIdentityService).patient$);
  protected readonly size = 10;
  protected readonly statusOptions = LAB_STATUSES.map((value) => ({ value, label: value.replace('_', ' ') }));
  protected readonly sev = sevOfStatus;
  protected readonly prio = sevOfPriority;
  protected readonly picked = signal<Patient | null>(null);
  protected readonly status = signal<LabStatus | null>(null);
  protected readonly page = signal(0);
  protected readonly reload$ = new BehaviorSubject<void>(undefined);
  protected readonly isPatient = computed(() => this.auth.role() === 'PATIENT');
  protected readonly ownMissing = computed(() => this.ownPatient() === null);
  protected get history() { return this.view() === 'history'; }
  protected readonly mode = computed<'staff' | 'patient' | 'none'>(() => {
    if (this.isPatient()) return this.ownPatient() ? 'patient' : 'none';
    if (this.view() === 'history') return this.picked() ? 'patient' : 'none';
    return 'staff';
  });
  private readonly patientId = computed(() => (this.isPatient() ? this.ownPatient()?.id : this.picked()?.id) ?? 0);
  protected readonly state = toSignal(
    combineLatest([toObservable(this.mode), toObservable(this.patientId), toObservable(this.status), toObservable(this.page), this.reload$]).pipe(
      debounceTime(0),
      switchMap(([mode, pid, status, page]) => toLoadState(
        mode === 'staff' ? this.api.requests({ status: status ?? undefined, page, size: this.size }).pipe(map((p: Page<LabRequest>): Row => ({ rows: p.content, total: p.totalElements })))
          : mode === 'patient' ? this.api.requestsForPatient(pid).pipe(map((r): Row => ({ rows: [...r].sort((a, b) => b.requestedAt.localeCompare(a.requestedAt)), total: r.length })))
          : of<Row>({ rows: [], total: 0 }))),
    ), { initialValue: { status: 'loading' } as LoadState<Row> });
  protected setStatus(s: LabStatus | null) { this.page.set(0); this.status.set(s); }
  protected lazy(e: TableLazyLoadEvent) { this.page.set(Math.floor((e.first ?? 0) / (e.rows ?? this.size))); }
}
