import { BusinessRuleError, ConflictError, Db, ForbiddenError, Row, ValidationError, audit, cache, hasPermission, key, requestContext, toDto, toDtos, withLock, round2, AuthUser, Topics, buildEvent, enqueueOutbox } from '@hr/common';
import { leaveConfig } from '../config';
import { BalanceRepository, EmployeeSnapshotRepository, LeaveTypeRepository, PolicyRepository, RunLogRepository } from '../repositories/leave.repository';

const BAL_FIELDS = ['employeeId', 'leaveTypeId', 'leaveTypeCode', 'leaveTypeName', 'balanceYear', 'opening', 'accrued', 'carriedForward', 'adjusted', 'used', 'pending', 'encashed', 'entitled', 'available', 'paid', 'balanceTracked'];

export class BalanceService {
  readonly balances: BalanceRepository;
  private readonly policies: PolicyRepository;
  private readonly types: LeaveTypeRepository;
  private readonly employees: EmployeeSnapshotRepository;
  private readonly runs: RunLogRepository;

  constructor(private readonly db: Db) {
    this.balances = new BalanceRepository(db); this.policies = new PolicyRepository(db); this.types = new LeaveTypeRepository(db);
    this.employees = new EmployeeSnapshotRepository(db); this.runs = new RunLogRepository(db);
  }

  assertCanRead(viewer: AuthUser, employeeId: string, managerId?: string | null): void {
    if (viewer.employeeId === employeeId || hasPermission(viewer, 'LEAVE_POLICY_MANAGE', 'LEAVE_APPROVE', 'TEAM_VIEW') && (!managerId || viewer.employeeId === managerId || hasPermission(viewer, 'LEAVE_POLICY_MANAGE'))) return;
    throw new ForbiddenError('You may only view your own leave balance');
  }

  /** Balances are cached per employee/year (access control is enforced before the cache is consulted). */
  async forEmployee(employeeId: string, year: number) {
    return cache.getOrLoad(key('leave', 'bal', employeeId, year), leaveConfig.balanceTtl, async () => toDtos(await this.balances.forEmployee(employeeId, year), BAL_FIELDS));
  }

  /** Same figures computed by the existing stored procedure (cross-check of recorded vs. application-derived usage). */
  reconcile(employeeId: string, year: number) { return this.balances.storedProcedure(employeeId, year).then((r) => toDtos(r)); }
  history(employeeId: string, year?: number) { return this.balances.history(employeeId, year).then((r) => toDtos(r)); }
  async evict(employeeId: string): Promise<void> { await cache.evictPrefix(key('leave', 'bal', employeeId)); }

  async available(employeeId: string, leaveTypeId: string, year: number, conn?: any, lock = false): Promise<{ row: Row | null; available: number }> {
    const row = await this.balances.get(employeeId, leaveTypeId, year, conn, lock);
    if (!row) return { row: null, available: 0 };
    return { row, available: round2(row.opening + row.accrued + row.carried_forward + row.adjusted - row.used - row.pending - row.encashed) };
  }

  // ------------------------------------------------------------------ initialisation & accrual
  /** Creates missing balance rows for an employee from the default policy (idempotent). */
  async initialise(employeeId: string, joiningDate: string | null, year: number, conn?: any): Promise<number> {
    const policy = await this.policies.defaultPolicy();
    if (!policy) return 0;
    const ents = await this.policies.entitlements(policy.id);
    let created = 0;
    for (const e of ents) {
      const existing = await this.balances.get(employeeId, e.leave_type_id, year, conn);
      if (existing) continue;
      const accrual = Number(e.accrual_per_month);
      const opening = accrual === 0 ? Number(e.annual_days) : 0; // lump-sum entitlements (maternity, paternity, ...)
      await this.balances.create(employeeId, e.leave_type_id, year, { opening, accrued: accrual > 0 ? this.accruedTo(e, joiningDate, year, new Date().getMonth() + 1) : 0, carried: 0 }, requestContext.user()?.username ?? 'system', conn);
      created++;
    }
    await this.evict(employeeId);
    return created;
  }

  private accruedTo(ent: Row, joiningDate: string | null, year: number, month: number): number {
    const startMonth = joiningDate && Number(joiningDate.slice(0, 4)) === year ? Number(joiningDate.slice(5, 7)) : 1;
    const months = Math.max(0, month - startMonth + 1);
    return round2(Math.min(Number(ent.annual_days), Number(ent.accrual_per_month) * months));
  }

  /** Monthly accrual. Setting accrued to the target is idempotent; a Redis lock + run log prevent concurrent/duplicate runs. */
  async runAccrual(year: number, month: number, by: string) {
    const runKey = `accrual:${year}-${String(month).padStart(2, '0')}`;
    const out = await withLock(runKey, 120000, async () => {
      const policy = await this.policies.defaultPolicy();
      if (!policy) throw new BusinessRuleError('No active leave policy configured');
      const ents = (await this.policies.entitlements(policy.id)).filter((e) => Number(e.accrual_per_month) > 0);
      const emps = await this.employees.activeEmployees();
      let processed = 0;
      for (const emp of emps) {
        await this.initialise(emp.employee_id, emp.joining_date, year);
        for (const e of ents) { await this.balances.setAccrued(emp.employee_id, e.leave_type_id, year, this.accruedTo(e, emp.joining_date, year, month), by); processed++; }
        await this.evict(emp.employee_id);
      }
      await this.db.exec('INSERT INTO leave_run_log (run_key, executed_at, executed_by, records_processed) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE executed_at = VALUES(executed_at), executed_by = VALUES(executed_by), records_processed = VALUES(records_processed)',
        [runKey, new Date(), by, processed]);
      return { runKey, employees: emps.length, records: processed };
    });
    if (!out) throw new ConflictError('An accrual run for this month is already in progress');
    return out;
  }

  /** Year-end carry-forward limited by policy.carry_forward_max; creates next-year balances. */
  async carryForward(fromYear: number, by: string) {
    const runKey = `carry-forward:${fromYear}`;
    if (await this.runs.findById(runKey)) throw new ConflictError(`Carry-forward for ${fromYear} has already been executed`);
    const policy = await this.policies.defaultPolicy();
    if (!policy) throw new BusinessRuleError('No active leave policy configured');
    const ents = new Map((await this.policies.entitlements(policy.id)).map((e) => [e.leave_type_id as string, e]));
    const emps = await this.employees.activeEmployees();
    let records = 0;
    await this.db.tx(async (conn) => {
      for (const emp of emps) {
        await this.initialise(emp.employee_id, emp.joining_date, fromYear + 1, conn);
        for (const b of await this.balances.forEmployee(emp.employee_id, fromYear)) {
          const ent = ents.get(b.leave_type_id);
          const max = ent ? Number(ent.carry_forward_max) : 0;
          const carry = Math.min(Math.max(0, Number(b.available)), max);
          if (carry > 0) {
            await this.db.exec('UPDATE leave_balances SET carried_forward = ?, version = version + 1, updated_at = ?, updated_by = ? WHERE employee_id = ? AND leave_type_id = ? AND balance_year = ?',
              [carry, new Date(), by, emp.employee_id, b.leave_type_id, fromYear + 1], conn);
            records++;
          }
        }
        await this.evict(emp.employee_id);
      }
      await this.db.exec('INSERT INTO leave_run_log (run_key, executed_at, executed_by, records_processed) VALUES (?,?,?,?)', [runKey, new Date(), by, records], conn);
    });
    return { runKey, employees: emps.length, carriedRecords: records };
  }

  // ------------------------------------------------------------------ manual adjustment & encashment
  async adjust(dto: { employeeId: string; leaveTypeId: string; year: number; days: number; reason: string }, by: string) {
    await this.db.tx(async (conn) => {
      const { row, available } = await this.available(dto.employeeId, dto.leaveTypeId, dto.year, conn, true);
      if (!row) throw new ValidationError('No balance row exists for that employee/leave type/year');
      if (available + dto.days < 0) throw new BusinessRuleError('Adjustment would make the balance negative');
      await this.balances.adjust(dto.employeeId, dto.leaveTypeId, dto.year, { adjusted: dto.days }, by, conn);
      await audit(this.db, conn, 'LeaveBalance', `${dto.employeeId}:${dto.leaveTypeId}:${dto.year}`, 'ADJUSTED', undefined, dto);
    });
    await this.evict(dto.employeeId);
    return this.forEmployee(dto.employeeId, dto.year);
  }

  async encash(dto: { employeeId: string; leaveTypeId: string; year: number; days: number }, by: string) {
    const policy = await this.policies.defaultPolicy();
    const ent = policy ? (await this.policies.entitlements(policy.id)).find((e) => e.leave_type_id === dto.leaveTypeId) : null;
    if (!ent || !ent.encashable) throw new BusinessRuleError('This leave type is not encashable under the current policy');
    await this.db.tx(async (conn) => {
      const { row, available } = await this.available(dto.employeeId, dto.leaveTypeId, dto.year, conn, true);
      if (!row) throw new ValidationError('No balance row exists for that employee/leave type/year');
      if (row.encashed + dto.days > Number(ent.encashment_max_days)) throw new BusinessRuleError(`Encashment limit of ${ent.encashment_max_days} days would be exceeded`);
      if (dto.days > available) throw new BusinessRuleError('Insufficient available balance to encash');
      await this.balances.adjust(dto.employeeId, dto.leaveTypeId, dto.year, { encashed: dto.days }, by, conn);
      await audit(this.db, conn, 'LeaveBalance', `${dto.employeeId}:${dto.leaveTypeId}:${dto.year}`, 'ENCASHED', undefined, dto);
      await enqueueOutbox(this.db, conn, Topics.NOTIFICATION_REQUESTED, buildEvent(Topics.NOTIFICATION_REQUESTED, 'leave-service', {
        type: 'LEAVE_ENCASHED', recipientEmployeeId: dto.employeeId, subject: 'Leave encashment recorded', body: `${dto.days} day(s) of leave were encashed for ${dto.year}. Payroll will include the payout.`,
      }, dto.employeeId));
    });
    await this.evict(dto.employeeId);
    return this.forEmployee(dto.employeeId, dto.year);
  }
}
void toDto;
