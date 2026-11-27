import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import type { StationDetail } from '../../core/models/models';
import { EmptyStateComponent, PageHeaderComponent, StatusChipComponent } from '../../shared/components/ui.components';

@Component({
  selector: 'app-station-detail', imports: [RouterLink, MatButtonModule, MatIconModule, PageHeaderComponent, StatusChipComponent, EmptyStateComponent], changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (station(); as s) {
      <div class="container">
        <app-page-header [title]="s.name + ' (' + s.code + ')'" [subtitle]="s.city + ', ' + s.state"><app-status-chip [status]="s.active ? 'ACTIVE' : 'INACTIVE'" /><a mat-stroked-button routerLink="/stations"><mat-icon>arrow_back</mat-icon>All stations</a></app-page-header>
        <div class="card"><h2>Trains calling here</h2>
          @for (r of s.routeStops ?? []; track r.route.id) {
            <p class="row spread"><a [routerLink]="['/trains', r.route.train.id]"><strong>{{ r.route.train.number }}</strong> {{ r.route.train.name }}</a><span class="muted">{{ r.arrivalTime ?? '—' }} arr · {{ r.departureTime ?? '—' }} dep</span></p>
          } @empty { <app-empty-state icon="train" title="No trains stop here yet" /> }
        </div>
      </div>
    }`,
})
export class StationDetailComponent { readonly station = input.required<StationDetail | null>(); }
