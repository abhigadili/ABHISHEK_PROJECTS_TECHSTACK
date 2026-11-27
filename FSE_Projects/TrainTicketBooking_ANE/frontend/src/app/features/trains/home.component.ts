import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { SearchHistoryService } from '../../core/services/search-history.service';
import { toIsoDate, addDays, today } from '../../shared/utils';
import { SearchFormComponent } from './search-form.component';

@Component({
  selector: 'app-home', imports: [SearchFormComponent, AsyncPipe, RouterLink, MatIconModule, MatButtonModule], changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="hero"><div class="in"><h1>Where to next?</h1><p>Real-time seat availability, segment-aware booking and instant PNR.</p>
      <div class="card"><app-search-form /></div></div></section>
    <section class="container">
      @if ((history.recent$ | async); as recent) { @if (recent.length) {
        <div class="row spread"><h2>Recent searches</h2><button class="link-btn" (click)="history.clear()">Clear</button></div>
        <div class="row">@for (r of recent; track r.at) { <button mat-stroked-button (click)="rerun(r.fromId, r.toId)"><mat-icon>history</mat-icon>{{ r.fromName }} → {{ r.toName }}</button> }</div>
      } }
      <h2>Why RailBook</h2>
      <div class="grid cols-3">
        <div class="card"><mat-icon>event_seat</mat-icon><h3>Smart seat allocation</h3><p class="muted">A seat freed at an intermediate stop is sold again for the rest of the journey.</p></div>
        <div class="card"><mat-icon>confirmation_number</mat-icon><h3>Instant PNR</h3><p class="muted">Confirmation and PNR the moment your payment succeeds.</p></div>
        <div class="card"><mat-icon>currency_rupee</mat-icon><h3>Transparent refunds</h3><p class="muted">See charges and your refund before you cancel.</p></div>
      </div>
      <p class="row"><a mat-stroked-button routerLink="/trains"><mat-icon>train</mat-icon>Browse all trains</a><a mat-stroked-button routerLink="/stations"><mat-icon>location_city</mat-icon>Stations</a></p>
    </section>`,
  styles: [`.hero{background:linear-gradient(135deg,#0f3b91,#1a56c7 65%,#3d7be0);padding:40px 16px 56px;color:#fff}.in{max-width:980px;margin:0 auto}.hero h1{font-size:2.2rem;margin:0}.hero p{opacity:.9;margin:6px 0 20px}.hero .card{color:var(--c-text)}.card mat-icon{color:var(--c-primary)}`],
})
export class HomeComponent {
  readonly history = inject(SearchHistoryService);
  private readonly router = inject(Router);
  rerun(from: number, to: number) { void this.router.navigate(['/search'], { queryParams: { from, to, date: toIsoDate(addDays(today(), 1)), pax: 1 } }); }
}
