import type { ISODateTime } from './common';

export interface AppNotification {
  id: number;
  recipientEmail: string;
  channel: 'EMAIL' | 'SMS';
  subject: string;
  message: string;
  eventType: string;
  referenceId: string | null;
  status: 'QUEUED' | 'SENT' | 'FAILED';
  createdAt: ISODateTime;
  sentAt: ISODateTime | null;
}

export interface SendNotificationRequest {
  recipientEmail: string;
  recipientPhone?: string | null;
  subject: string;
  message: string;
}
