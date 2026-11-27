import { ChangeDetectionStrategy, Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { map } from 'rxjs';
import { Employee } from '../../core/models/employee.models';
import { EmployeeService } from '../../core/services/employee.service';
import { PermissionService } from '../../core/services/permission.service';
import { ToastService } from '../../core/services/toast.service';
import { DialogService } from '../../shared/components/dialogs';
import { ProfilePictureComponent } from '../../shared/components/profile-picture.component';
import { StatusBadgeComponent } from '../../shared/components/ui-basics';
import { HasPermissionDirective } from '../../shared/directives/directives';
import { EmployeeNamePipe, EmployeeStatusPipe, EmploymentTypePipe } from '../../shared/pipes/pipes';
import { EmployeeDetailsState } from './employee-details.state';
import { JobChangeDialogComponent } from './job-change-dialog.component';

/**
 * Details shell for /employees/:id. Reads the resolver's data via ActivatedRoute (Observable) and publishes it to the
 * route-scoped EmployeeDetailsState so the child tabs share one source. Tabs are child routes (relative links).
 */
@Component({
  selector: 'app-employee-details',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink, RouterLinkActive, RouterOutlet, MatButtonModule, MatIconModule, MatTabsModule, ProfilePictureComponent,
    StatusBadgeComponent, HasPermissionDirective, EmployeeStatusPipe, EmploymentTypePipe, EmployeeNamePipe,
  ],
  template: `
    @if (state.employee(); as e) {
      <div class="page">
        <a class="back" [routerLink]="backLink" data-testid="back-link"><mat-icon>arrow_back</mat-icon> {{ backLabel }}</a>
        <header class="head panel">
          <app-profile-picture [employeeId]="e.id" [hasPicture]="!!e.profilePictureUrl" [name]="e.fullName" [size]="72" />
          <div class="who">
            <h1 data-testid="employee-name">{{ e | employeeName }}</h1>
            <div class="muted">{{ e.jobTitle || e.designation?.name || 'No job title' }} · {{ e.department?.name || 'No department' }}</div>
            <div class="badges">
              <app-status-badge [value]="e.status" [label]="e.status | employeeStatus" />
              <app-status-badge kind="info" [label]="e.employmentType | employmentType" />
              <span class="muted code">{{ e.employeeCode }}</span>
            </div>
          </div>
          <div class="actions">
            <a mat-stroked-button [routerLink]="['profile']"><mat-icon>badge</mat-icon> Profile</a>
            <ng-container *appHasPermission="'employee.write'">
              <button mat-stroked-button type="button" (click)="jobChange()" data-testid="job-change"><mat-icon>trending_up</mat-icon> Promote / transfer</button>
              <a mat-flat-button [routerLink]="['edit']" data-testid="edit-employee"><mat-icon>edit</mat-icon> Edit</a>
              @if (e.status === 'ACTIVE') {
                <button mat-stroked-button color="warn" type="button" (click)="deactivate(e)"><mat-icon>person_off</mat-icon> Deactivate</button>
              } @else {
                <button mat-stroked-button type="button" (click)="reactivate(e)"><mat-icon>person_check</mat-icon> Reactivate</button>
              }
            </ng-container>
          </div>
        </header>

        <nav mat-tab-nav-bar [tabPanel]="panel" class="tabs">
          <a mat-tab-link routerLink="overview" routerLinkActive #o="routerLinkActive" [active]="o.isActive" data-testid="tab-overview">Overview</a>
          <a mat-tab-link routerLink="history" routerLinkActive #h="routerLinkActive" [active]="h.isActive" data-testid="tab-history">Job history</a>
          <a mat-tab-link routerLink="background" routerLinkActive #b="routerLinkActive" [active]="b.isActive" data-testid="tab-background">Education & experience</a>
        </nav>
        <mat-tab-nav-panel #panel><div class="panel tab-body"><router-outlet /></div></mat-tab-nav-panel>
      </div>
    }
  `,
  styles: `
    .back { display: inline-flex; align-items: center; gap: 4px; text-decoration: none; margin-bottom: 12px; }
    .head { display: flex; gap: 20px; align-items: center; flex-wrap: wrap; margin-bottom: 16px; }
    .who { flex: 1; min-width: 220px; }
    h1 { margin: 0; font-size: 1.5rem; font-weight: 500; }
    .badges { display: flex; gap: 8px; align-items: center; margin-top: 8px; }
    .code { font-size: 12px; }
    .actions { display: flex; gap: 8px; flex-wrap: wrap; }
    .tab-body { border-top-left-radius: 0; border-top-right-radius: 0; }
  `,
})
export class EmployeeDetailsComponent {
  protected readonly state = inject(EmployeeDetailsState);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly employees = inject(EmployeeService);
  private readonly dialogs = inject(DialogService);
  private readonly dialog = inject(MatDialog);
  private readonly toast = inject(ToastService);
  protected readonly permissions = inject(PermissionService);

  /** Navigation state passed by the list ("where did I come from?") — falls back to the list. */
  protected readonly backLink: string;
  protected readonly backLabel: string;

  constructor() {
    const from = (this.router.getCurrentNavigation()?.extras.state?.['from'] ?? history.state?.from) as string | undefined;
    this.backLink = from && from.startsWith('/employees') ? from : '/employees';
    this.backLabel = from?.includes('?') ? 'Back to filtered list' : 'Back to employees';

    // Route data is an Observable: it re-emits when the resolver re-runs (e.g. after we reload the route).
    this.route.data
      .pipe(map((d) => d['employee'] as Employee), takeUntilDestroyed(inject(DestroyRef)))
      .subscribe((e) => {
        // seed once per employee; later edits publish fresher data into the state (resolvers don't re-run for child navigation)
        if (this.state.employee()?.id !== e.id) this.state.set(e);
      });
  }

  protected jobChange(): void {
    const e = this.state.employee();
    if (!e) return;
    this.dialog.open<JobChangeDialogComponent, Employee, boolean>(JobChangeDialogComponent, { data: e, maxWidth: '95vw' }).afterClosed().subscribe((changed) => {
      if (changed) {
        this.toast.success('Job change recorded');
        this.refresh(e.id);
        this.state.bumpHistory();
      }
    });
  }

  protected deactivate(e: Employee): void {
    this.dialogs
      .askReason({ title: `Deactivate ${e.fullName}?`, label: 'Reason (optional)', required: false, confirmLabel: 'Deactivate', danger: true })
      .subscribe((reason) => this.employees.deactivate(e.id, { reason: reason || undefined }).subscribe(() => {
        this.toast.success('Employee deactivated');
        this.refresh(e.id);
        this.state.bumpHistory();
      }));
  }

  protected reactivate(e: Employee): void {
    this.employees.reactivate(e.id).subscribe(() => {
      this.toast.success('Employee reactivated');
      this.refresh(e.id);
      this.state.bumpHistory();
    });
  }

  private refresh(id: number): void {
    this.employees.get(id).subscribe((e) => this.state.set(e));
  }
}
