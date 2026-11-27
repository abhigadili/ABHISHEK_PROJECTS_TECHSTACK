import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { catchError, map, of, startWith, switchMap } from 'rxjs';
import { AppError, PageMeta } from '../../core/models/api.models';
import { Department } from '../../core/models/organization.models';
import { DepartmentService } from '../../core/services/department.service';
import { ToastService } from '../../core/services/toast.service';
import { CellDirective, DataTableComponent, TableColumn } from '../../shared/components/data-table.component';
import { DialogService } from '../../shared/components/dialogs';
import { SearchBoxComponent } from '../../shared/components/search-box.component';
import { ErrorMessageComponent, PageHeaderComponent, StatusBadgeComponent } from '../../shared/components/ui-basics';
import { HasPermissionDirective } from '../../shared/directives/directives';

interface Result { items: Department[]; meta: PageMeta | null; error: AppError | null }

@Component({
  selector: 'app-department-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, MatButtonModule, MatFormFieldModule, MatIconModule, MatSelectModule, MatTooltipModule, DataTableComponent, CellDirective, SearchBoxComponent, PageHeaderComponent, ErrorMessageComponent, StatusBadgeComponent, HasPermissionDirective],
  template: `
    <div class="page">
      <app-page-header title="Departments" subtitle="Organisational units, their heads and headcount">
        <a pageActions mat-flat-button routerLink="/departments/new" *appHasPermission="'department.write'" data-testid="new-department"><mat-icon>add</mat-icon> New department</a>
      </app-page-header>
      <div class="panel">
        <div class="toolbar-row">
          <div class="grow"><app-search-box label="Search departments" placeholder="Name or code" (searchChange)="q.set($event); page.set(1)" /></div>
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Status</mat-label>
            <mat-select [value]="active()" (selectionChange)="active.set($event.value); page.set(1)">
              <mat-option [value]="null">All</mat-option>
              <mat-option [value]="true">Active</mat-option>
              <mat-option [value]="false">Inactive</mat-option>
            </mat-select>
          </mat-form-field>
        </div>
        <app-error-message [error]="result().error" (retry)="reload()" />
        <app-data-table testId="department-table" [columns]="columns" [rows]="result().items" [meta]="result().meta" [clickable]="true" emptyIcon="domain" emptyTitle="No departments found"
          (pageChange)="page.set($event.page); limit.set($event.limit)" (rowClick)="open($event)">
          <ng-template appCell="name" let-d><a [routerLink]="['/departments', d.id]" (click)="$event.stopPropagation()"><strong>{{ d.name }}</strong></a><div class="muted">{{ d.description }}</div></ng-template>
          <ng-template appCell="headName" let-d>{{ d.headName ?? '—' }}</ng-template>
          <ng-template appCell="isActive" let-d><app-status-badge [value]="d.isActive" [label]="d.isActive ? 'Active' : 'Inactive'" /></ng-template>
          <ng-template appCell="actions" let-d>
            <div class="row-actions" (click)="$event.stopPropagation()" (keydown.enter)="$event.stopPropagation()">
              <ng-container *appHasPermission="'department.write'">
                <a mat-icon-button [routerLink]="['/departments', d.id, 'edit']" matTooltip="Edit" aria-label="Edit department"><mat-icon>edit</mat-icon></a>
                @if (d.isActive) {
                  <button mat-icon-button type="button" matTooltip="Deactivate" aria-label="Deactivate department" (click)="deactivate(d)"><mat-icon>block</mat-icon></button>
                } @else {
                  <button mat-icon-button type="button" matTooltip="Activate" aria-label="Activate department" (click)="activate(d)"><mat-icon>check_circle</mat-icon></button>
                }
              </ng-container>
            </div>
          </ng-template>
        </app-data-table>
      </div>
    </div>
  `,
  styles: `.grow { flex: 1 1 260px; }`,
})
export class DepartmentListComponent {
  private readonly departments = inject(DepartmentService);
  private readonly router = inject(Router);
  private readonly dialogs = inject(DialogService);
  private readonly toast = inject(ToastService);

  protected readonly q = signal('');
  protected readonly active = signal<boolean | null>(null);
  protected readonly page = signal(1);
  protected readonly limit = signal(10);
  private readonly refresh = signal(0);

  private readonly query = computed(() => ({ q: this.q(), isActive: this.active(), page: this.page(), limit: this.limit(), v: this.refresh() }));
  protected readonly result = toSignal(
    toObservable(this.query).pipe(
      switchMap((f) =>
        this.departments.list(f).pipe(
          map((p): Result => ({ items: p.items, meta: p.meta, error: null })),
          catchError((error: AppError) => of<Result>({ items: [], meta: null, error })),
          startWith<Result | null>(null),
        ),
      ),
      map((r) => r ?? { items: [], meta: null, error: null }),
    ),
    { initialValue: { items: [], meta: null, error: null } as Result },
  );

  protected readonly columns: TableColumn[] = [
    { key: 'code', label: 'Code' },
    { key: 'name', label: 'Department' },
    { key: 'headName', label: 'Head' },
    { key: 'headcount', label: 'Active employees', align: 'end' },
    { key: 'isActive', label: 'Status' },
    { key: 'actions', label: '', align: 'end' },
  ];

  protected open(d: Department): void {
    void this.router.navigate(['/departments', d.id]);
  }

  protected reload(): void {
    this.refresh.update((n) => n + 1);
  }

  protected deactivate(d: Department): void {
    this.dialogs.confirm({ title: `Deactivate ${d.name}?`, message: 'A department that still has active employees cannot be deactivated (the backend enforces this).', confirmLabel: 'Deactivate', danger: true }).subscribe(() => {
      this.departments.deactivate(d.id).subscribe(() => {
        this.toast.success('Department deactivated');
        this.reload();
      });
    });
  }

  protected activate(d: Department): void {
    this.departments.activate(d.id).subscribe(() => {
      this.toast.success('Department activated');
      this.reload();
    });
  }
}
