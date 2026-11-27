import { Db, Repository, Row } from '@hr/common';

export class NotificationRepository extends Repository {
  constructor(db: Db) { super(db, 'notifications', { sortable: ['created_at', 'read_at', 'status'], searchable: ['subject', 'body'] }); }
  unreadCount(employeeId: string): Promise<number> {
    return this.db.scalar<number>("SELECT COUNT(*) FROM notifications WHERE recipient_employee_id = ? AND channel = 'IN_APP' AND read_at IS NULL", [employeeId]).then(Number);
  }
  markAllRead(employeeId: string): Promise<unknown> {
    return this.db.exec("UPDATE notifications SET read_at = ?, updated_at = ? WHERE recipient_employee_id = ? AND channel = 'IN_APP' AND read_at IS NULL", [new Date(), new Date(), employeeId]);
  }
}
export class TemplateRepository extends Repository { constructor(db: Db) { super(db, 'notification_templates'); } byCode(code: string): Promise<Row | null> { return this.findOne({ code, active: 1 }); } }
export class SettingsRepository extends Repository {
  constructor(db: Db) { super(db, 'email_settings'); }
  async current(): Promise<Row | null> { return this.db.one('SELECT * FROM email_settings ORDER BY created_at DESC LIMIT 1'); }
}
export class EventHistoryRepository extends Repository { constructor(db: Db) { super(db, 'event_history', { sortable: ['occurred_at', 'topic'] }); } }
export class ContactRepository extends Repository { constructor(db: Db) { super(db, 'employee_contacts', { pk: ['employee_id'] }); } }
