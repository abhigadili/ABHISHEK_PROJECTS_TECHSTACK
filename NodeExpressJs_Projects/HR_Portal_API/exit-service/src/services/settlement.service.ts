import { AuthUser, BusinessRuleError, ConflictError, Db, ForbiddenError, Row, Topics, audit, buildEvent, enqueueOutbox, hasPermission, round2, toDto, toDtos, diffDays, today } from '@hr/common';
import { PayrollClient } from '../clients/exit.clients';
import { ResignationRepository, SettlementRepository } from '../repositories/exit.repository';
import type { ResignationService } from './resignation.service';

export class SettlementService {
  private readonly settlements: SettlementRepository; private readonly resignations: ResignationRepository; private readonly payroll = new PayrollClient();
  constructor(private readonly db: Db, private readonly core: ResignationService) { this.settlements = new SettlementRepository(db); this.resignations = new ResignationRepository(db); }

  /** Calculates the full & final statement: pro-rata salary, notice shortfall recovery (+ manual lines); totals by the existing stored procedure. */
  async calculate(resignationId: string, u: AuthUser) {
    const r = await this.resignations.getById(resignationId, 'Resignation');
    if (r.status !== 'INTERVIEW_DONE' && r.status !== 'SETTLEMENT_PENDING') throw new BusinessRuleError('Settlement can be calculated after the exit interview');
    const existing = await this.settlements.findOne({ resignation_id: resignationId });
    if (existing?.status === 'PAID') throw new ConflictError('Settlement is already paid');
    const policy = await this.core.policy.current();
    const basis = await this.payroll.basis(r.employee_id).catch(() => null);
    if (!basis) throw new BusinessRuleError('Could not determine the salary basis from payroll (no active salary?)');
    const daily = basis.monthlyGross / Number(policy.salary_days_per_month);
    const lwd: string = r.confirmed_last_working_day;
    const daysWorkedInMonth = Number(lwd.slice(8, 10));
    const shortfall = Math.max(0, Number(r.notice_period_days) - diffDays(r.submitted_on, lwd) - Number(r.waiver_days));
    const auto: { type: 'EARNING' | 'DEDUCTION'; code: string; description: string; amount: number }[] = [
      { type: 'EARNING', code: 'SALARY_PRORATA', description: `Salary for ${daysWorkedInMonth} day(s) of ${lwd.slice(0, 7)}`, amount: round2(daily * Math.min(daysWorkedInMonth, Number(policy.salary_days_per_month))) },
    ];
    if (shortfall > 0) auto.push({ type: 'DEDUCTION', code: 'NOTICE_SHORTFALL', description: `Notice shortfall recovery (${shortfall} day(s))`, amount: round2(daily * shortfall) });
    await this.db.tx(async (conn) => {
      const s = existing ?? (await this.settlements.insert({ resignation_id: resignationId, employee_id: r.employee_id, status: 'CALCULATED', gross_payable: 0, recoveries: 0, net_payable: 0, calculated_by: u.userId }, conn));
      await this.db.exec("DELETE FROM settlement_lines WHERE settlement_id = ? AND code IN ('SALARY_PRORATA','NOTICE_SHORTFALL')", [s.id], conn);
      for (const l of auto) await this.db.exec('INSERT INTO settlement_lines (id, created_at, updated_at, amount, code, description, settlement_id, type) VALUES (UUID(),?,?,?,?,?,?,?)', [new Date(), new Date(), l.amount, l.code, l.description, s.id, l.type], conn);
      if (r.status === 'INTERVIEW_DONE') await this.core.transition(conn, r, 'SETTLEMENT_PENDING', {}, 'Settlement calculated');
      await audit(this.db, conn, 'Settlement', s.id, 'CALCULATED');
    });
    return this.view(resignationId, u);
  }

  /** HR adds manual lines (leave encashment, asset recovery, reimbursements ...). */
  async addLine(resignationId: string, dto: { type: string; code: string; description: string; amount: number }, u: AuthUser) {
    const s = await this.settlements.findOne({ resignation_id: resignationId });
    if (!s) throw new BusinessRuleError('Calculate the settlement first');
    if (s.status === 'PAID') throw new BusinessRuleError('Settlement is already paid');
    await this.db.exec('INSERT INTO settlement_lines (id, created_at, updated_at, amount, code, description, settlement_id, type) VALUES (UUID(),?,?,?,?,?,?,?)', [new Date(), new Date(), dto.amount, dto.code, dto.description, s.id, dto.type]);
    await audit(this.db, undefined, 'Settlement', s.id, 'LINE_ADDED', undefined, dto);
    return this.view(resignationId, u);
  }

  async view(resignationId: string, u: AuthUser) {
    const r = await this.resignations.getById(resignationId, 'Resignation');
    if (!hasPermission(u, 'EXIT_MANAGE', 'PAYROLL_PROCESS', 'PAYROLL_VIEW') && r.employee_id !== u.employeeId) throw new ForbiddenError();
    const s = await this.settlements.findOne({ resignation_id: resignationId });
    if (!s) return null;
    const summary = (await this.settlements.summary(resignationId))[0]; // recomputes totals via sp_exit_settlement_summary
    const fresh = await this.settlements.getById(s.id);
    return { ...toDto(fresh), tenureMonths: summary?.tenure_months ?? null, noticeShortfallDays: summary?.notice_shortfall_days ?? null, lines: toDtos(await this.settlements.lines(s.id)) };
  }

  /** Payroll processes the final settlement: posts it to payroll as an adjustment, marks it paid and completes the exit. */
  async process(resignationId: string, paymentReference: string | undefined, u: AuthUser) {
    const r = await this.resignations.getById(resignationId, 'Resignation');
    if (r.status !== 'SETTLEMENT_PENDING') throw new BusinessRuleError('Resignation is not awaiting settlement');
    await this.settlements.summary(resignationId);
    const s = await this.settlements.findOne({ resignation_id: resignationId });
    if (!s || s.status !== 'CALCULATED') throw new BusinessRuleError('Settlement has not been calculated');
    const net = Number(s.net_payable);
    // external effect first (idempotent per referenceId on the payroll side); then local transaction
    if (net !== 0) {
      await this.payroll.postSettlement({ employeeId: r.employee_id, amount: net, month: String(r.confirmed_last_working_day).slice(0, 7), referenceId: s.id, description: `Full & final settlement (${r.employee_name})` });
    }
    await this.db.tx(async (conn) => {
      await this.settlements.update(s.id, { status: 'PAID', paid_at: new Date(), processed_by: u.userId, payment_reference: paymentReference ?? null }, conn);
      await this.core.transition(conn, r, 'COMPLETED', { completed_at: new Date() }, 'Final settlement processed');
      const payload = { resignationId, employeeId: r.employee_id, exitDate: r.confirmed_last_working_day, lastWorkingDay: r.confirmed_last_working_day, netSettlement: net };
      await enqueueOutbox(this.db, conn, Topics.EMPLOYEE_EXITED, buildEvent(Topics.EMPLOYEE_EXITED, 'exit-service', payload, r.employee_id));
      await enqueueOutbox(this.db, conn, Topics.NOTIFICATION_REQUESTED, buildEvent(Topics.NOTIFICATION_REQUESTED, 'exit-service', { type: 'EXIT_COMPLETED', recipientEmployeeId: r.employee_id, subject: 'Exit completed', body: 'Your final settlement has been processed. Thank you for your contributions.', referenceType: 'Resignation', referenceId: resignationId }, r.employee_id));
    });
    return this.core.get(resignationId, u);
  }
}
void today;
