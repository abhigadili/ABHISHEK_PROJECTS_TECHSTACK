import { Injectable, inject } from '@angular/core';
import { ToastrService } from 'ngx-toastr';
import { TranslateService } from '@ngx-translate/core';

/** Thin wrapper over ngx-toastr: translates keys, and ngx-toastr's `preventDuplicates` avoids repeating the same message. */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly t = inject(ToastrService);
  private readonly tr = inject(TranslateService);
  private msg(m: string, p?: object) { const v = this.tr.instant(m, p); return v === m ? m : v; }
  success(m: string, p?: object) { this.t.success(this.msg(m, p)); }
  error(m: string, p?: object) { this.t.error(this.msg(m, p)); }
  info(m: string, p?: object) { this.t.info(this.msg(m, p)); }
  warning(m: string, p?: object) { this.t.warning(this.msg(m, p)); }
}
