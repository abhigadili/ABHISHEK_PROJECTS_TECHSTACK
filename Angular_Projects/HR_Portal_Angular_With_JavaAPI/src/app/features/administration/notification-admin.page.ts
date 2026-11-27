import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { PermissionService } from '../../core/services/permission.service';
import { PageHeaderComponent, TabDirective, TabsComponent } from '../../shared/components/ui.components';
import { CrudSectionComponent } from '../../shared/op/crud-section.component';
import { OpButtonComponent } from '../../shared/op/op-button.component';
import { OpViewComponent } from '../../shared/op/op-view.component';
import { type Col } from '../../shared/tables/data-table.component';
import { OpTableComponent } from '../../shared/tables/op-table.component';

const TPL = { bodyTemplate: { rich: true } };
@Component({
  selector: 'app-notification-admin-page', standalone: true, changeDetection: ChangeDetectionStrategy.Default,
  imports: [FormsModule, TranslateModule, PageHeaderComponent, TabsComponent, TabDirective, CrudSectionComponent, OpViewComponent, OpTableComponent, OpButtonComponent],
  template: `<app-page-header [title]="'hr.admin.notifications' | translate" [subtitle]="'hr.admin.notificationsSub' | translate"><app-op-button op="notification.send" label="Send notification" icon="pi-send" variant="primary" size="md" dialogSize="lg" [overrides]="sendOv" /></app-page-header>
  <app-tabs>
    <ng-template appTab="templates" label="Templates"><app-crud-section title="Notification templates" [list]="{ op: 'notification.templates' }" [create]="{ op: 'notification.createTemplate', overrides: tpl }" [update]="{ op: 'notification.updateTemplate', path: idp, overrides: tpl }" dialogSize="xl" tableId="tpl" [columns]="tplCols" /></ng-template>
    <ng-template appTab="email" label="E-mail settings"><app-op-view op="notification.emailSettings" title="Outgoing e-mail"><span actions><app-op-button op="notification.updateEmailSettings" [label]="'common.edit' | translate" variant="primary" /></span></app-op-view></ng-template>
    <ng-template appTab="history" label="Delivery history"><app-op-table op="notification.history" tableId="notif-hist" [query]="f()" [columns]="histCols">
      <span filters class="contents"><input class="form-control" style="width:170px" placeholder="employeeId" [ngModel]="f().employeeId" (ngModelChange)="f.set({ employeeId: $event, type: f().type, status: f().status })" aria-label="employeeId" />
        <input class="form-control" style="width:130px" placeholder="type" [ngModel]="f().type" (ngModelChange)="f.set({ employeeId: f().employeeId, type: $event, status: f().status })" aria-label="type" />
        <input class="form-control" style="width:120px" placeholder="status" [ngModel]="f().status" (ngModelChange)="f.set({ employeeId: f().employeeId, type: f().type, status: $event })" aria-label="status" /></span></app-op-table></ng-template>
    <ng-template appTab="events" label="Kafka events" [hidden]="!perm.isAdmin()"><div class="d-grid gap-3"><app-op-view op="notification.topics" title="Kafka topics" />
      <app-op-table op="notification.eventHistory" tableId="event-hist" [query]="ev()"><span filters class="contents"><input class="form-control" style="width:220px" placeholder="topic" [ngModel]="ev().topic" (ngModelChange)="ev.set({ topic: $event, employeeId: ev().employeeId })" aria-label="topic" />
        <input class="form-control" style="width:180px" placeholder="employeeId" [ngModel]="ev().employeeId" (ngModelChange)="ev.set({ topic: ev().topic, employeeId: $event })" aria-label="employeeId" /></span></app-op-table></div></ng-template>
  </app-tabs>`,
})
export class NotificationAdminPage {
  perm = inject(PermissionService); tpl = TPL; idp = (r: any) => ({ id: r.id }); f = signal({ employeeId: '', type: '', status: '' }); ev = signal({ topic: '', employeeId: '' });
  sendOv = { message: { rich: true }, channels: { options: ['EMAIL', 'IN_APP'].map((v) => ({ value: v, label: v })) } };
  tplCols: Col[] = [{ key: 'code' }, { key: 'subjectTemplate' }, { key: 'bodyTemplate' }, { key: 'active' }];
  histCols: Col[] = [{ key: 'recipientEmployeeId' }, { key: 'type' }, { key: 'channel' }, { key: 'subject' }, { key: 'status' }, { key: 'sentAt' }, { key: 'createdAt', hidden: true }];
}
export default NotificationAdminPage;
