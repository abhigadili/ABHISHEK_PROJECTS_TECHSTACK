import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { Employee } from '../../core/models/employee.models';
import { EmployeeStatusPipe } from '../pipes/pipes';
import { HighlightDirective } from '../directives/directives';
import { ProfilePictureComponent } from './profile-picture.component';
import { StatusBadgeComponent } from './ui-basics';

/** Compact directory card. OnPush + signal inputs: re-renders only when its `employee` input changes. */
@Component({
  selector: 'app-employee-card',
  standalone: true,
  imports: [MatCardModule, MatIconModule, ProfilePictureComponent, StatusBadgeComponent, EmployeeStatusPipe, HighlightDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mat-card appearance="outlined" class="card" appHighlight tabindex="0" (click)="selected.emit(employee())" (keydown.enter)="selected.emit(employee())">
      <mat-card-content>
        <app-profile-picture [employeeId]="employee().id" [hasPicture]="!!employee().profilePictureUrl" [name]="employee().fullName" [size]="48" />
        <div class="info">
          <strong>{{ employee().fullName }}</strong>
          <span>{{ employee().jobTitle || employee().designation?.name || '—' }}</span>
          <span class="muted">{{ employee().department?.name || 'No department' }}</span>
        </div>
        <app-status-badge [value]="employee().status" [label]="employee().status | employeeStatus" />
      </mat-card-content>
    </mat-card>
  `,
  styles: `
    .card { cursor: pointer; }
    mat-card-content { display: flex; align-items: center; gap: 12px; padding: 12px 16px; }
    .info { display: flex; flex-direction: column; flex: 1; min-width: 0; }
    .muted { color: var(--ems-muted); font-size: 12px; }
  `,
})
export class EmployeeCardComponent {
  readonly employee = input.required<Employee>();
  readonly selected = output<Employee>();
}
