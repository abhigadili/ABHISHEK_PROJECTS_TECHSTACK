import { Db, EventEnvelope, EventHandler, Topics, ALL_TOPICS, employeeSnapshotConsumers, upsertRow, Row } from '@hr/common';
import { NotificationService } from '../services/notification.service';

/** Maps domain events to notifications (recipient + template + variables). */
const RULES: Record<string, (ev: EventEnvelope<any>) => Array<{ type: string; recipient?: string | null; vars: Row }>> = {
  [Topics.LEAVE_APPLIED]: (e) => { const p = e.payload; return p.managerId ? [{ type: 'LEAVE_APPLIED', recipient: p.managerId, vars: { employeeName: p.employeeName, leaveType: p.leaveType, fromDate: p.fromDate, toDate: p.toDate, days: p.days } }] : []; },
  [Topics.LEAVE_APPROVED]: (e) => { const p = e.payload; return [{ type: 'LEAVE_APPROVED', recipient: p.employeeId, vars: { leaveType: p.leaveType, fromDate: p.fromDate, toDate: p.toDate, days: p.days, comment: p.comment ?? '' } }]; },
  [Topics.LEAVE_REJECTED]: (e) => { const p = e.payload; return [{ type: 'LEAVE_REJECTED', recipient: p.employeeId, vars: { leaveType: p.leaveType, fromDate: p.fromDate, toDate: p.toDate, comment: p.comment ?? '' } }]; },
  [Topics.LEAVE_CANCELLED]: (e) => { const p = e.payload; return [{ type: 'LEAVE_CANCELLED', recipient: p.employeeId, vars: { leaveType: p.leaveType, fromDate: p.fromDate, toDate: p.toDate, comment: p.reason ?? '' } }]; },
  [Topics.ATTENDANCE_CORRECTED]: (e) => { const p = e.payload; return [{ type: p.decision === 'APPROVED' ? 'CORRECTION_APPROVED' : 'CORRECTION_REJECTED', recipient: p.employeeId, vars: { date: p.workDate, comment: p.comment ?? '' } }]; },
  [Topics.PAYSLIP_GENERATED]: (e) => [{ type: 'PAYSLIP_AVAILABLE', recipient: e.payload.employeeId, vars: { month: e.payload.month } }],
  [Topics.TIMESHEET_SUBMITTED]: (e) => { const p = e.payload; return p.approverId ? [{ type: 'TIMESHEET_SUBMITTED', recipient: p.approverId, vars: { employeeName: p.employeeName, weekStart: p.weekStart, hours: p.totalHours } }] : []; },
  [Topics.TIMESHEET_APPROVED]: (e) => [{ type: 'TIMESHEET_APPROVED', recipient: e.payload.employeeId, vars: { weekStart: e.payload.weekStart } }],
  [Topics.RESIGNATION_SUBMITTED]: (e) => { const p = e.payload; return p.managerId ? [{ type: 'EXIT_RESIGNATION_SUBMITTED', recipient: p.managerId, vars: { employeeName: p.employeeName, lastWorkingDay: p.requestedLastWorkingDay } }] : []; },
  [Topics.PERFORMANCE_REVIEW_SUBMITTED]: (e) => { const p = e.payload; return p.stage === 'SELF' && p.managerId ? [{ type: 'REVIEW_MANAGER_TURN', recipient: p.managerId, vars: { employeeName: '' } }] : []; },
};

/** Every business event is recorded in event_history; mapped events also create notifications. */
export function notificationConsumers(db: Db): Record<string, EventHandler> {
  const svc = new NotificationService(db);
  const generic: EventHandler = async (ev, conn, meta) => {
    await svc.recordEvent(ev, meta, conn);
    for (const r of RULES[meta.topic.replace(/\.retry$/, '')]?.(ev) ?? []) await svc.notify({ type: r.type, recipientEmployeeId: r.recipient, variables: r.vars, correlationId: ev.correlationId, dedupeKey: `${ev.eventId}:${r.type}:${r.recipient}` }, conn);
  };
  const requested: EventHandler = async (ev, conn, meta) => {
    await svc.recordEvent(ev, meta, conn);
    const p = ev.payload as Row;
    await svc.notify({ type: p.type ?? 'MANUAL_MESSAGE', recipientEmployeeId: p.recipientEmployeeId, recipientEmail: p.recipientEmail, subject: p.subject, body: p.body, templateCode: p.templateCode, variables: p.variables, referenceType: p.referenceType, referenceId: p.referenceId, dedupeKey: p.dedupeKey, correlationId: ev.correlationId }, conn);
  };
  const contacts = employeeSnapshotConsumers(db, 'employee_contacts', (s) => ({ employee_id: s.employeeId, email: s.workEmail, full_name: s.fullName }), generic);
  const handlers: Record<string, EventHandler> = {};
  for (const t of ALL_TOPICS) handlers[t] = generic;
  handlers[Topics.NOTIFICATION_REQUESTED] = requested;
  for (const t of Object.keys(contacts)) handlers[t] = contacts[t]; // employee lifecycle: refresh contact + record
  void upsertRow;
  return handlers;
}
