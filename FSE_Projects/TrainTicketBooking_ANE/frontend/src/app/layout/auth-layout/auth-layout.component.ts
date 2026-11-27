import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-auth-layout', imports: [RouterOutlet, RouterLink, MatIconModule], changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="wrap">
      <aside class="hero" aria-hidden="true"><mat-icon>train</mat-icon><h1>RailBook</h1><p>Search trains, choose your seats, pay securely and carry your PNR anywhere.</p></aside>
      <main id="main" tabindex="-1" class="panel"><a routerLink="/" class="back">← Back to search</a><div class="box"><router-outlet /></div></main>
    </div>`,
  styles: [`.wrap{display:grid;grid-template-columns:1fr 1fr;min-height:100vh}.hero{background:linear-gradient(135deg,#0f3b91,#1a56c7 60%,#3d7be0);color:#fff;display:flex;flex-direction:column;justify-content:center;padding:48px}
    .hero mat-icon{font-size:56px;width:56px;height:56px}.hero h1{font-size:2.4rem;margin:8px 0}.hero p{font-size:1.1rem;max-width:380px;opacity:.9}
    .panel{display:flex;flex-direction:column;padding:24px}.back{text-decoration:none;font-size:.9rem}.box{margin:auto;width:100%;max-width:440px;padding:24px 0}
    @media (max-width:820px){.wrap{grid-template-columns:1fr}.hero{display:none}}`],
})
export class AuthLayoutComponent {}
