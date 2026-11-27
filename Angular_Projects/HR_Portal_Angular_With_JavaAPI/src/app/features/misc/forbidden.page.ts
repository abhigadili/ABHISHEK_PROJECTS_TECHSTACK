import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
@Component({
  selector: 'app-forbidden-page', standalone: true, imports: [RouterLink, TranslateModule], changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="text-center p-5"><i class="pi pi-lock" style="font-size:40px;color:var(--hr-danger)"></i><h2 class="mt-3">{{ 'common.notAuthorized' | translate }}</h2><p class="text-muted">{{ 'common.notAuthorizedHint' | translate }}</p><a routerLink="/" class="btn-hr primary">{{ 'nav.home' | translate }}</a></div>`,
})
export class ForbiddenPage {}
export default ForbiddenPage;
