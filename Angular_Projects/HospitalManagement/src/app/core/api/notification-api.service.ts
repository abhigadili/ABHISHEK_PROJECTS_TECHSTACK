import { HttpContext } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { SILENT_ERRORS, SKIP_LOADING } from '../interceptors/http-context';
import type { AppNotification, Page, SendNotificationRequest } from '../models';
import { BaseApiService } from './base-api.service';

@Injectable({ providedIn: 'root' })
export class NotificationApiService extends BaseApiService {
  protected readonly resource = 'notifications';
  /** Background polling must not flash the global loading bar nor toast on failure → HttpContext flags. */
  private readonly quiet = () => new HttpContext().set(SKIP_LOADING, true).set(SILENT_ERRORS, true);
  all(p: { eventType?: string; email?: string; page?: number; size?: number } = {}): Observable<Page<AppNotification>> { return this.get<Page<AppNotification>>('', { ...p }, this.quiet()); }
  my(p: { page?: number; size?: number } = {}): Observable<Page<AppNotification>> { return this.get<Page<AppNotification>>('/my', { ...p }, this.quiet()); }
  getById(id: number): Observable<AppNotification> { return this.get<AppNotification>(`/${id}`); }
  send(b: SendNotificationRequest): Observable<AppNotification> { return this.post<AppNotification, SendNotificationRequest>('/send', b); }
}
