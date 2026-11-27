import { JsonPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { MatTabsModule } from '@angular/material/tabs';
import { catchError, map, of, startWith, switchMap } from 'rxjs';
import { AppError, PageMeta } from '../../core/models/api.models';
import { ApiService } from '../../core/services/api.service';
import { PermissionService } from '../../core/services/permission.service';
import { CellDirective, DataTableComponent, TableColumn } from '../../shared/components/data-table.component';
import { ErrorMessageComponent, PageHeaderComponent } from '../../shared/components/ui-basics';
import { ServerDateTimePipe } from '../../shared/pipes/pipes';
import { ReportPanelComponent, reportDefinitions } from './report-panel.component';

interface AuditRow {
  id: number;
  userId: number | null;
  action: string;
  entityType: string;
  entityId: string | null;
  details: unknown;
  requestId: string | null;
  createdAt: string;
}
interface AuditResult { items: AuditRow[]; meta: PageMeta | null; error: AppError | null }

/** Audit log (admins): server-side pagination; `details` is arbitrary JSON, shown with JsonPipe. */
@Component({
  selector: 'app-audit-log',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [JsonPipe, DataTableComponent, CellDirective, ErrorMessageComponent, ServerDateTimePipe],
  template: `
    <p class="muted">Who did what and when (HR / super admin only).</p>
    <app-error-message [error]="result().error" (retry)="page.set(page())" />
    <app-data-table testId="audit-table" [columns]="columns" [rows]="result().items" [meta]="result().meta" emptyIcon="history" emptyTitle="No audit entries" (pageChange)="page.set($event.page); limit.set($event.limit)">
      <ng-template appCell="createdAt" let-r>{{ r.createdAt | serverDateTime }}</ng-template>
      <ng-template appCell="details" let-r>@if (r.details) { <code>{{ r.details | json }}</code> } @else { — }</ng-template>
    </app-data-table>
  `,
  styles: `code { font-size: 11px; white-space: pre-wrap; display: block; max-width: 360px; }`,
})
export class AuditLogComponent {
  private readonly api = inject(ApiService);
  protected readonly page = signal(1);
  protected readonly limit = signal(10);
  protected readonly columns: TableColumn[] = [
    { key: 'createdAt', label: 'When' }, { key: 'userId', label: 'User' }, { key: 'action', label: 'Action' },
    { key: 'entityType', label: 'Entity' }, { key: 'entityId', label: 'Entity id' }, { key: 'details', label: 'Details' },
  ];
  protected readonly result = toSignal(
    toObservable(computed(() => ({ page: this.page(), limit: this.limit() }))).pipe(
      switchMap((q) =>
        this.api.getPaged<AuditRow>('/audit-logs', q).pipe(
          map((p): AuditResult => ({ items: p.items, meta: p.meta, error: null })),
          catchError((error: AppError) => of<AuditResult>({ items: [], meta: null, error })),
          startWith<AuditResult | null>(null),
        ),
      ),
      map((r) => r ?? { items: [], meta: null, error: null }),
    ),
    { initialValue: { items: [], meta: null, error: null } as AuditResult },
  );
}

@Component({
  selector: 'app-reports',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatTabsModule, PageHeaderComponent, ReportPanelComponent, AuditLogComponent],
  template: `
    <div class="page">
      <app-page-header title="Reports" subtitle="Backend-generated reports with filters, search, pagination and CSV export" />
      <mat-tab-group animationDuration="0" mat-stretch-tabs="false" data-testid="report-tabs">
        @for (d of visible(); track d.id) {
          <mat-tab [label]="d.label">
            <ng-template matTabContent><div class="panel tab"><app-report-panel [def]="d" /></div></ng-template>
          </mat-tab>
        }
        @if (permissions.has('audit.view')) {
          <mat-tab label="Audit log"><ng-template matTabContent><div class="panel tab"><app-audit-log /></div></ng-template></mat-tab>
        }
      </mat-tab-group>
    </div>
  `,
  styles: `.tab { margin-top: 12px; }`,
})
export class ReportsComponent {
  protected readonly permissions = inject(PermissionService);
  private readonly defs = reportDefinitions();
  protected readonly visible = computed(() => this.defs.filter((d) => !d.permission || this.permissions.has(d.permission)));
}
