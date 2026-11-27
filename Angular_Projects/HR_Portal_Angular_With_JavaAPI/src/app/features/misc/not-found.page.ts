import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
@Component({
  selector: 'app-not-found-page', standalone: true, imports: [RouterLink, TranslateModule], changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="text-center p-5"><div style="font-size:48px;font-weight:700">404</div><p class="text-muted">{{ 'common.notFound' | translate }}</p><a routerLink="/" class="btn-hr primary">{{ 'nav.home' | translate }}</a></div>`,
})
export class NotFoundPage {}
export default NotFoundPage;
