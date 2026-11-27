import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { EmptyStateComponent } from '../../shared/components/ui-basics';

@Component({
  selector: 'app-unauthorized',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, MatButtonModule, EmptyStateComponent],
  template: `
    <div class="page">
      <app-empty-state icon="lock" title="Access denied" message="Your role does not allow you to open this page.">
        <a mat-flat-button routerLink="/dashboard">Back to dashboard</a>
      </app-empty-state>
    </div>
  `,
})
export class UnauthorizedComponent {}

@Component({
  selector: 'app-not-found',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, MatButtonModule, EmptyStateComponent],
  template: `
    <div class="page">
      <app-empty-state icon="search_off" title="Page not found" message="The page you are looking for does not exist.">
        <a mat-flat-button routerLink="/dashboard">Go to dashboard</a>
      </app-empty-state>
    </div>
  `,
})
export class NotFoundComponent {}
