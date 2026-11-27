import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { map } from 'rxjs';
import { Employee } from '../../core/models/employee.models';
import { EmployeeService } from '../../core/services/employee.service';
import { ToastService } from '../../core/services/toast.service';
import { DialogService } from '../../shared/components/dialogs';
import { FileUploadComponent } from '../../shared/components/file-upload.component';
import { ProfilePictureComponent } from '../../shared/components/profile-picture.component';
import { PageHeaderComponent } from '../../shared/components/ui-basics';
import { HasPermissionDirective } from '../../shared/directives/directives';
import { PermissionService } from '../../core/services/permission.service';

/**
 * /employees/:id/profile — the "business card" view plus profile-picture management for HR.
 * The id is read from ActivatedRoute (parameter Observable) and the resolved employee from route data.
 */
@Component({
  selector: 'app-employee-profile',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, MatButtonModule, MatCardModule, MatIconModule, ProfilePictureComponent, FileUploadComponent, PageHeaderComponent, HasPermissionDirective],
  template: `
    <div class="page narrow">
      @if (employee(); as e) {
        <app-page-header [title]="e.fullName" subtitle="Employee profile">
          <a pageActions mat-stroked-button [routerLink]="['/employees', e.id]"><mat-icon>arrow_back</mat-icon> Details</a>
        </app-page-header>
        <mat-card appearance="outlined">
          <mat-card-content class="card">
            <app-profile-picture [employeeId]="e.id" [hasPicture]="hasPicture()" [name]="e.fullName" [size]="128" />
            <div class="info">
              <h2>{{ e.fullName }}</h2>
              <div>{{ e.jobTitle || e.designation?.name || '—' }}</div>
              <div class="muted">{{ e.department?.name || 'No department' }} · {{ e.workLocation || 'No location' }}</div>
              <div class="contact"><mat-icon>mail</mat-icon> <a [href]="'mailto:' + e.workEmail">{{ e.workEmail }}</a></div>
              @if (e.phone) {
                <div class="contact"><mat-icon>call</mat-icon> {{ e.phone }}</div>
              }
              @if (e.manager) {
                <div class="contact"><mat-icon>supervisor_account</mat-icon> Reports to <a [routerLink]="['/employees', e.manager.id]">{{ e.manager.name }}</a></div>
              }
              <div class="pic-actions" *appHasPermission="'employee.write'">
                <app-file-upload label="Upload picture" icon="photo_camera" [disabled]="busy()" (fileSelected)="upload(e, $event)" />
                @if (hasPicture()) {
                  <button mat-button color="warn" type="button" [disabled]="busy()" (click)="remove(e)" data-testid="remove-picture"><mat-icon>delete</mat-icon> Remove picture</button>
                }
              </div>
            </div>
          </mat-card-content>
        </mat-card>
      }
    </div>
  `,
  styles: `
    .narrow { max-width: 800px; }
    .card { display: flex; gap: 24px; align-items: center; flex-wrap: wrap; padding: 24px; }
    .info { flex: 1; min-width: 240px; }
    h2 { margin: 0 0 4px; font-weight: 500; }
    .contact { display: flex; gap: 8px; align-items: center; margin-top: 8px; }
    .pic-actions { display: flex; gap: 8px; align-items: center; margin-top: 16px; flex-wrap: wrap; }
  `,
})
export class EmployeeProfileComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly employees = inject(EmployeeService);
  private readonly toast = inject(ToastService);
  private readonly dialogs = inject(DialogService);
  protected readonly permissions = inject(PermissionService);

  protected readonly employee = signal<Employee | null>(null);
  protected readonly busy = signal(false);
  private readonly pictureOverride = signal<boolean | null>(null);
  protected readonly hasPicture = computed(() => this.pictureOverride() ?? !!this.employee()?.profilePictureUrl);

  constructor() {
    this.route.data.pipe(map((d) => d['employee'] as Employee), takeUntilDestroyed(inject(DestroyRef))).subscribe((e) => {
      this.employee.set(e);
      this.pictureOverride.set(null);
    });
  }

  protected upload(e: Employee, file: File): void {
    this.busy.set(true);
    this.employees.uploadPicture(e.id, file).subscribe({
      next: () => {
        this.pictureOverride.set(true);
        this.busy.set(false);
        this.toast.success('Profile picture updated');
      },
      error: (err: { message: string }) => {
        this.busy.set(false);
        this.toast.error(err.message);
      },
    });
  }

  protected remove(e: Employee): void {
    this.dialogs.confirm({ title: 'Remove profile picture?', message: 'The initials avatar will be shown instead.', confirmLabel: 'Remove', danger: true }).subscribe(() => {
      this.employees.removePicture(e.id).subscribe(() => {
        this.pictureOverride.set(false);
        this.toast.success('Profile picture removed');
      });
    });
  }
}
