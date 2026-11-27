import { ChangeDetectionStrategy, Component } from '@angular/core';
import { APP } from '../../core/config/app.config';
@Component({
  selector: 'app-footer', standalone: true, changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<footer class="no-print px-4 py-3 text-muted text-center" style="font-size:12px">{{ app }} · {{ year }}</footer>`,
})
export class FooterComponent { app = APP.name; year = new Date().getFullYear(); }
