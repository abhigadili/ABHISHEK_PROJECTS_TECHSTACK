import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { PermissionService } from '../../core/services/permission.service';
import { PageHeaderComponent } from '../../shared/components/ui-basics';
import { ReportPanelComponent, reportDefinitions } from '../reports/report-panel.component';

/** /attendance/reports reuses the generic report panel with the two attendance report definitions. */
@Component({
  selector: 'app-attendance-reports',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, MatButtonModule, MatIconModule, MatTabsModule, PageHeaderComponent, ReportPanelComponent],
  template: `
    <div class="page">
      <app-page-header title="Attendance reports" subtitle="Monthly and departmental attendance">
        <a pageActions mat-stroked-button routerLink="/attendance"><mat-icon>arrow_back</mat-icon> Attendance</a>
      </app-page-header>
      <mat-tab-group animationDuration="0">
        @for (d of defs(); track d.id) {
          <mat-tab [label]="d.label"><ng-template matTabContent><div class="panel" style="margin-top: 12px"><app-report-panel [def]="d" /></div></ng-template></mat-tab>
        }
      </mat-tab-group>
    </div>
  `,
})
export class AttendanceReportsComponent {
  private readonly permissions = inject(PermissionService);
  private readonly all = reportDefinitions().filter((d) => d.id.startsWith('attendance-'));
  protected readonly defs = computed(() => this.all.filter((d) => !d.permission || this.permissions.has(d.permission)));
}
