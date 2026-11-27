import { Component, Injectable, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { TranslateModule } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { UiPipe } from '../pipes/format.pipes';

export interface ConfirmData { title?: string; message?: string; danger?: boolean; confirmLabel?: string }
@Component({
  selector: 'app-confirm-dialog', standalone: true, imports: [MatDialogModule, TranslateModule, UiPipe],
  template: `<h2 mat-dialog-title style="font-size:16px">{{ (data.title || ('common.confirm' | translate)) | ui }}</h2>
    <mat-dialog-content>{{ data.message | ui }}</mat-dialog-content>
    <mat-dialog-actions align="end"><button type="button" class="btn-hr outline" (click)="ref.close(false)">{{ 'common.cancel' | translate }}</button>
      <button type="button" class="btn-hr" [class.danger]="data.danger" [class.primary]="!data.danger" (click)="ref.close(true)" cdkFocusInitial>{{ data.confirmLabel || ('common.confirm' | translate) }}</button></mat-dialog-actions>`,
})
export class ConfirmDialogComponent { data = inject<ConfirmData>(MAT_DIALOG_DATA); ref = inject(MatDialogRef<ConfirmDialogComponent, boolean>); }

@Injectable({ providedIn: 'root' })
export class ConfirmService {
  private readonly dialog = inject(MatDialog);
  async ask(data: ConfirmData): Promise<boolean> { return !!(await firstValueFrom(this.dialog.open(ConfirmDialogComponent, { data, width: '420px', maxWidth: '96vw' }).afterClosed())); }
}
