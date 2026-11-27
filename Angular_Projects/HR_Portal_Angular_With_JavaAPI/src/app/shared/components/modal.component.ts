import { ChangeDetectionStrategy, Component, TemplateRef, ViewChild, effect, inject, input, output, OnDestroy } from '@angular/core';
import { MatDialog, MatDialogModule, type MatDialogRef } from '@angular/material/dialog';
import { UiPipe } from '../pipes/format.pipes';

const WIDTH = { sm: '440px', md: '620px', lg: '880px', xl: '1120px' };
/** Dialog (Angular Material / CDK overlay: focus trap, Esc, backdrop). Content is projected, so wrap it in `@if (open)` to create it lazily. */
@Component({
  selector: 'app-modal', standalone: true, imports: [MatDialogModule, UiPipe], changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<ng-template #tpl>
    <div class="d-flex align-items-start justify-content-between gap-2 px-4 pt-3">
      <div><h2 class="m-0" style="font-size:16px">{{ title() | ui }}</h2>@if (description()) { <div class="text-muted" style="font-size:12px">{{ description() }}</div> }</div>
      <button type="button" class="btn-hr ghost icon" (click)="requestClose()" aria-label="Close"><i class="pi pi-times"></i></button></div>
    <mat-dialog-content class="!pt-3"><ng-content /></mat-dialog-content>
    <mat-dialog-actions class="!px-4 !pb-3" align="end"><ng-content select="[footer]" /></mat-dialog-actions></ng-template>`,
})
export class ModalComponent implements OnDestroy {
  private readonly dialog = inject(MatDialog);
  @ViewChild('tpl', { static: true }) tpl!: TemplateRef<unknown>;
  open = input(false); title = input(''); description = input(''); size = input<'sm' | 'md' | 'lg' | 'xl'>('md');
  closed = output<void>();
  private ref?: MatDialogRef<unknown>;
  constructor() {
    effect(() => {
      const o = this.open();
      if (o && !this.ref) {
        this.ref = this.dialog.open(this.tpl, { width: WIDTH[this.size()], maxWidth: '96vw', maxHeight: '92vh', autoFocus: 'dialog', restoreFocus: true });
        this.ref.afterClosed().subscribe(() => { this.ref = undefined; this.closed.emit(); });
      } else if (!o && this.ref) { const r = this.ref; this.ref = undefined; r.close(); }
    });
  }
  requestClose() { this.ref?.close(); }
  ngOnDestroy() { this.ref?.close(); }
}
