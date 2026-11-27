import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { ApiClient } from '../../api/client/api-client.service';
import { PermissionService } from '../../core/services/permission.service';
import { ToastService } from '../../core/services/toast.service';
import { saveBlob } from '../utilities/exporters';

/** Downloads (or prints) a binary endpoint such as a payslip PDF or a stored document. */
@Component({
  selector: 'app-download-button', standalone: true, imports: [TranslateModule], changeDetection: ChangeDetectionStrategy.OnPush,
  template: `@if (allowed()) { <button type="button" class="btn-hr sm" [class]="variant()" [disabled]="busy()" (click)="go()">@if (busy()) { <i class="pi pi-spin pi-spinner"></i> } @else { <i class="pi" [class.pi-print]="print()" [class.pi-download]="!print()"></i> }{{ label() || (print() ? ('common.print' | translate) : ('common.download' | translate)) }}</button> }`,
})
export class DownloadButtonComponent {
  private api = inject(ApiClient); private perm = inject(PermissionService); private toast = inject(ToastService);
  op = input.required<string>(); path = input<Record<string, string | number>>(); query = input<Record<string, unknown>>(); filename = input.required<string>();
  print = input(false); label = input(''); variant = input('ghost'); busy = signal(false);
  allowed = computed(() => this.perm.canCall(this.op()));
  async go() {
    this.busy.set(true);
    try {
      const blob = await firstValueFrom(this.api.call<Blob>(this.op(), { path: this.path(), query: this.query() }));
      if (this.print()) { const url = URL.createObjectURL(new Blob([blob], { type: blob.type || 'application/pdf' })); const w = window.open(url, '_blank'); w?.addEventListener('load', () => w.print()); setTimeout(() => URL.revokeObjectURL(url), 60_000); }
      else { saveBlob(blob, this.filename()); this.toast.success('common.fileDownloaded'); }
    } catch (e: any) { this.toast.error(e.message); } finally { this.busy.set(false); }
  }
}
