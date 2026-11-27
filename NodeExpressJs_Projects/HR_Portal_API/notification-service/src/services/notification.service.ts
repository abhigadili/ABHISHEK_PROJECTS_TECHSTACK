import nodemailer from 'nodemailer';
import {
  AuthUser, ConflictError, Db, ForbiddenError, Row, Topics, ValidationError, audit, buildEvent, enqueueOutbox, env, hasPermission, listTopics, logger, pageRequest, seenRecently, toDto, toDtoPage, toDtos, NotFoundError,
} from '@hr/common';
import { notificationConfig } from '../config';
import { NOTIFICATION_FIELDS } from '../dto/notification.dto';
import { ContactRepository, EventHistoryRepository, NotificationRepository, SettingsRepository, TemplateRepository } from '../repositories/notification.repository';

export interface NotifyRequest {
  type: string; recipientEmployeeId?: string | null; recipientEmail?: string | null; subject?: string; body?: string; templateCode?: string; variables?: Record<string, unknown>;
  referenceType?: string | null; referenceId?: string | null; dedupeKey?: string; correlationId?: string;
}

/** {{name}} placeholders; unknown placeholders render empty. */
export function render(template: string, vars: Record<string, unknown>): string {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, k: string) => { const v = vars[k]; return v === undefined || v === null ? '' : String(v); }).replace(/\s{2,}/g, ' ').trim();
}

export class NotificationService {
  private readonly notifications: NotificationRepository; private readonly templates: TemplateRepository; private readonly settings: SettingsRepository; private readonly history: EventHistoryRepository; private readonly contacts: ContactRepository;
  constructor(private readonly db: Db) { this.notifications = new NotificationRepository(db); this.templates = new TemplateRepository(db); this.settings = new SettingsRepository(db); this.history = new EventHistoryRepository(db); this.contacts = new ContactRepository(db); }

  // ---------------------------------------------------------------- creating notifications
  /** Creates the in-app notification and (when enabled) the email, using a template or inline text. De-duplicated via Redis. */
  async notify(req: NotifyRequest, conn?: any): Promise<void> {
    if (req.dedupeKey && (await seenRecently(`notif:${req.dedupeKey}`, notificationConfig.dedupeSeconds))) { logger.info({ dedupeKey: req.dedupeKey }, 'notification de-duplicated'); return; }
    const contact = req.recipientEmployeeId ? await this.contacts.findById(req.recipientEmployeeId, conn) : null;
    const vars = { name: contact?.full_name ?? '', ...(req.variables ?? {}) };
    let subject = req.subject; let body = req.body;
    if (!subject || !body) {
      const t = await this.templates.byCode(req.templateCode ?? req.type);
      if (!t) { logger.warn({ type: req.type }, 'no template and no inline text; notification skipped'); return; }
      subject = subject ?? render(t.subject_template, vars); body = body ?? render(t.body_template, vars);
    }
    const email = req.recipientEmail ?? contact?.email ?? null;
    const base = { type: req.type, subject: subject!.slice(0, 250), body: body!.slice(0, 2000), recipient_employee_id: req.recipientEmployeeId ?? null, recipient_email: email, reference_type: req.referenceType ?? null, reference_id: req.referenceId ?? null, correlation_id: req.correlationId ?? null };
    if (req.recipientEmployeeId) await this.notifications.insert({ ...base, channel: 'IN_APP', status: 'SENT', sent_at: new Date() }, conn);
    await this.deliverEmail(base, email, conn);
  }

  private async deliverEmail(base: Row, email: string | null, conn?: any): Promise<void> {
    const s = await this.settings.current();
    let status: 'SENT' | 'SKIPPED' | 'FAILED' = 'SKIPPED'; let error: string | null = null;
    if (email && s?.enabled) {
      try {
        if (s.mode === 'SMTP') {
          const transport = nodemailer.createTransport({ host: s.host, port: s.port, secure: s.port === 465, requireTLS: !!s.start_tls, auth: s.username ? { user: s.username, pass: env('SMTP_PASSWORD', '') } : undefined, connectionTimeout: 8000 });
          await transport.sendMail({ from: s.from_address, to: email, subject: base.subject, text: base.body });
        } else logger.info({ to: email.replace(/(^.).*(@.*$)/, '$1***$2'), subject: base.subject }, 'email (LOG mode)');
        status = 'SENT';
      } catch (e: any) { status = 'FAILED'; error = String(e.message).slice(0, 250); logger.error({ err: e.message }, 'email delivery failed'); }
    }
    await this.notifications.insert({ ...base, channel: 'EMAIL', status, error_message: error, sent_at: status === 'SENT' ? new Date() : null }, conn);
  }

  // ---------------------------------------------------------------- reading
  async mine(u: AuthUser, q: Record<string, any>) {
    if (!u.employeeId) throw new ForbiddenError('Your account is not linked to an employee');
    const where: Record<string, unknown> = { recipient_employee_id: u.employeeId, channel: q.channel ?? 'IN_APP' };
    if (q.unread === 'true') where.read_at = null; if (q.type) where.type = q.type;
    return toDtoPage(await this.notifications.page(where, pageRequest(q), q.q), NOTIFICATION_FIELDS);
  }
  async unreadCount(u: AuthUser) { return { unread: u.employeeId ? await this.notifications.unreadCount(u.employeeId) : 0 }; }
  async markRead(u: AuthUser, id: string) {
    const n = await this.notifications.getById(id, 'Notification');
    if (n.recipient_employee_id !== u.employeeId) throw new ForbiddenError();
    if (!n.read_at) await this.notifications.update(id, { read_at: new Date() });
    return toDto(await this.notifications.getById(id), NOTIFICATION_FIELDS);
  }
  async markUnread(u: AuthUser, id: string) {
    const n = await this.notifications.getById(id, 'Notification');
    if (n.recipient_employee_id !== u.employeeId) throw new ForbiddenError();
    await this.notifications.update(id, { read_at: null }); return toDto(await this.notifications.getById(id), NOTIFICATION_FIELDS);
  }
  async markAllRead(u: AuthUser) { if (u.employeeId) await this.notifications.markAllRead(u.employeeId); return this.unreadCount(u); }
  /** Delivery log for admins (all channels). */
  async delivery(q: Record<string, any>) {
    const where: Record<string, unknown> = {}; if (q.channel) where.channel = q.channel; if (q.type) where.type = q.type;
    return toDtoPage(await this.notifications.page(where, pageRequest(q), q.q), [...NOTIFICATION_FIELDS, 'recipientEmployeeId', 'errorMessage']);
  }

  // ---------------------------------------------------------------- templates & settings
  listTemplates() { return this.templates.findAll({}, { by: 'code' }).then((r) => toDtos(r)); }
  async upsertTemplate(dto: Row) {
    const row = { code: dto.code, subject_template: dto.subjectTemplate, body_template: dto.bodyTemplate, description: dto.description ?? null, active: dto.active ? 1 : 0 };
    const ex = await this.templates.findOne({ code: dto.code });
    if (ex) await this.templates.update(ex.id, row); else await this.templates.insert(row);
    await audit(this.db, undefined, 'NotificationTemplate', dto.code, ex ? 'UPDATED' : 'CREATED');
    return toDto(await this.templates.findOne({ code: dto.code }));
  }
  async preview(code: string, vars: Record<string, unknown>) {
    const t = await this.templates.findOne({ code }); if (!t) throw new NotFoundError('Template', code);
    return { subject: render(t.subject_template, vars), body: render(t.body_template, vars) };
  }
  async getSettings() { const s = await this.settings.current(); return s ? toDto(s, ['id', 'enabled', 'mode', 'fromAddress', 'host', 'port', 'username', 'startTls']) : null; }
  async updateSettings(dto: Row) {
    const row = { enabled: dto.enabled ? 1 : 0, mode: dto.mode, from_address: dto.fromAddress, host: dto.host ?? null, port: dto.port ?? null, username: dto.username ?? null, start_tls: dto.startTls ? 1 : 0 };
    const cur = await this.settings.current();
    if (cur) await this.settings.update(cur.id, row); else await this.settings.insert(row);
    await audit(this.db, undefined, 'EmailSettings', 'email', 'UPDATED', undefined, { mode: dto.mode, enabled: dto.enabled });
    return this.getSettings();
  }

  /** Manual broadcast to employees (publishes through the same event pipeline so delivery is asynchronous). */
  async manual(dto: { employeeIds: string[]; subject: string; message: string }, u: AuthUser) {
    if (!hasPermission(u, 'NOTIFICATION_MANAGE')) throw new ForbiddenError();
    await this.db.tx(async (conn) => {
      for (const id of dto.employeeIds) await enqueueOutbox(this.db, conn, Topics.NOTIFICATION_REQUESTED, buildEvent(Topics.NOTIFICATION_REQUESTED, 'notification-service', { type: 'MANUAL_MESSAGE', recipientEmployeeId: id, subject: dto.subject, body: dto.message }, id));
    });
    return { queued: dto.employeeIds.length };
  }

  // ---------------------------------------------------------------- event history
  async recordEvent(ev: { eventId: string; eventType: string; timestamp: string; correlationId: string; source: string; employeeId?: string | null; payload: unknown }, meta: { topic: string; partition: number; offset: string }, conn: any): Promise<void> {
    await this.history.insert({ event_id: ev.eventId, event_type: ev.eventType, topic: meta.topic, partition_no: meta.partition, offset_no: Number(meta.offset), occurred_at: new Date(ev.timestamp), correlation_id: ev.correlationId, source_service: ev.source, employee_id: ev.employeeId ?? null, payload: JSON.stringify(ev.payload).slice(0, 16000) }, conn);
  }
  async eventHistory(q: Record<string, any>) {
    const where: Record<string, unknown> = {}; if (q.topic) where.topic = q.topic; if (q.employeeId) where.employee_id = q.employeeId; if (q.eventType) where.event_type = q.eventType;
    const page = await this.history.page(where, pageRequest({ sort: 'occurred_at', ...q }));
    return toDtoPage({ ...page, content: page.content.map((r) => ({ ...r, payload: undefined })) });
  }
  async eventDetail(id: string) { const r = await this.history.findById(id); if (!r) throw new NotFoundError('Event', id); return toDto(r); }
  topics() { return listTopics('notification-service'); }
}
void ConflictError; void ValidationError;
