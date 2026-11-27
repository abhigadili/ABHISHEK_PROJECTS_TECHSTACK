import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { EmptyStateComponent } from '../shared/components/ui.components';
@Component({ selector: 'app-not-found', imports: [RouterLink, MatButtonModule, EmptyStateComponent], changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<main id="main" class="container"><app-empty-state icon="sentiment_dissatisfied" title="Page not found" message="The page you are looking for does not exist."><a mat-flat-button routerLink="/">Back to search</a></app-empty-state></main>` })
export class NotFoundComponent {}
