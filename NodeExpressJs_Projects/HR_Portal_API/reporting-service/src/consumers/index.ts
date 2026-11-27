import { Db, EventEnvelope, EventHandler, Topics, employeeSnapshotConsumers, Row } from '@hr/common';
import { FactRepository } from '../repositories/reporting.repository';

const month = (d?: string | null): string | null => (d ? d.slice(0, 7) : null);

/** Kafka-maintained reporting data: rpt_employees (read model) and rpt_facts (one row per business fact). */
export function reportingConsumers(db: Db): Record<string, EventHandler> {
  const facts = new FactRepository(db);
  const at = (e: EventEnvelope) => new Date(e.timestamp);
  const leave = (status: string): EventHandler => async (e, conn) => {
    const p = e.payload as Row;
    await facts.record({ type: 'LEAVE', subjectKey: p.applicationId, category: p.leaveType, status, period: month(p.fromDate), dateA: p.fromDate, dateB: p.toDate, employeeId: p.employeeId, a: p.days, occurredAt: at(e) }, conn);
  };
  const attendance = (status: string): EventHandler => async (e, conn) => {
    const p = e.payload as Row;
    await facts.record({ type: 'ATTENDANCE', subjectKey: `${p.employeeId}:${p.workDate}:${status}`, category: p.workMode ?? null, status, period: month(p.workDate), dateA: p.workDate, employeeId: p.employeeId, a: p.workedMinutes ?? null, b: p.overtimeMinutes ?? null, c: p.lateMinutes ?? null, occurredAt: at(e) }, conn);
  };
  const timesheet = (status: string): EventHandler => async (e, conn) => {
    const p = e.payload as Row;
    await facts.record({ type: 'TIMESHEET', subjectKey: p.timesheetId, status, period: month(p.weekStart), dateA: p.weekStart, employeeId: p.employeeId, a: p.totalHours, occurredAt: at(e) }, conn);
  };
  const snapshot = employeeSnapshotConsumers(db, 'rpt_employees', (s) => ({
    employee_id: s.employeeId, department_id: s.departmentId, designation_id: s.designationId, employee_code: s.employeeCode, exit_date: s.exitDate, full_name: s.fullName, joining_date: s.joiningDate, location_id: s.locationId, manager_id: s.managerId, status: s.status,
  }));
  return {
    ...snapshot,
    [Topics.LEAVE_APPLIED]: leave('APPLIED'), [Topics.LEAVE_APPROVED]: leave('APPROVED'), [Topics.LEAVE_REJECTED]: leave('REJECTED'), [Topics.LEAVE_CANCELLED]: leave('CANCELLED'),
    [Topics.ATTENDANCE_CHECKED_IN]: attendance('CHECKED_IN'), [Topics.ATTENDANCE_CHECKED_OUT]: attendance('CHECKED_OUT'), [Topics.ATTENDANCE_CORRECTED]: attendance('CORRECTED'),
    [Topics.TIMESHEET_SUBMITTED]: timesheet('SUBMITTED'), [Topics.TIMESHEET_APPROVED]: timesheet('APPROVED'),
    [Topics.TAX_DECLARATION_SUBMITTED]: async (e, conn) => { const p = e.payload as Row; await facts.record({ type: 'TAX', subjectKey: p.declarationId, category: p.regime, status: 'SUBMITTED', period: p.financialYear, employeeId: p.employeeId, a: p.totalDeclared, occurredAt: at(e) }, conn); },
    [Topics.PERFORMANCE_REVIEW_SUBMITTED]: async (e, conn) => { const p = e.payload as Row; await facts.record({ type: 'REVIEW', subjectKey: `${p.reviewId}:${p.stage}`, category: p.stage, status: 'SUBMITTED', employeeId: p.employeeId, occurredAt: at(e) }, conn); },
    [Topics.RESIGNATION_SUBMITTED]: async (e, conn) => { const p = e.payload as Row; await facts.record({ type: 'EXIT', subjectKey: p.resignationId, status: 'SUBMITTED', period: month(p.requestedLastWorkingDay), dateA: p.requestedLastWorkingDay, employeeId: p.employeeId, occurredAt: at(e) }, conn); },
    [Topics.PAYROLL_PROCESSED]: async (e, conn) => { const p = e.payload as Row; await facts.record({ type: 'PAYROLL', subjectKey: p.runId, status: 'FINALIZED', period: p.month, a: p.totalNet, b: p.employeeCount, occurredAt: at(e) }, conn); },
    [Topics.EMPLOYEE_EXITED]: async (e, conn) => {
      const p = e.payload as Row;
      if (p.resignationId) await facts.record({ type: 'EXIT', subjectKey: p.resignationId, status: 'EXITED', period: month(p.exitDate), dateA: p.exitDate, employeeId: e.employeeId, a: p.netSettlement ?? null, occurredAt: at(e) }, conn);
      await snapshot[Topics.EMPLOYEE_EXITED](e, conn, { topic: Topics.EMPLOYEE_EXITED, partition: 0, offset: '0' }); // keep the read model in step
    },
  };
}
