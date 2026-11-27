import {
  AuthUser, BusinessRuleError, ConflictError, Db, ForbiddenError, Row, ValidationError, audit, cache, hasPermission, key, toColumns, toDto, toDtos, today, addDays, round2,
} from '@hr/common';
import { payrollConfig } from '../config';
import { ComponentRepository, ConfigRepository, RevisionRepository, SalaryRepository, StructureRepository } from '../repositories/payroll.repository';

const SALARY_FIELDS = ['id', 'employeeId', 'structureId', 'annualCtc', 'currency', 'effectiveFrom', 'effectiveTo', 'status', 'version'];

export class SalaryService {
  readonly components: ComponentRepository; readonly structures: StructureRepository; readonly salaries: SalaryRepository;
  private readonly revisions: RevisionRepository; private readonly config: ConfigRepository;
  constructor(private readonly db: Db) {
    this.components = new ComponentRepository(db); this.structures = new StructureRepository(db); this.salaries = new SalaryRepository(db); this.revisions = new RevisionRepository(db); this.config = new ConfigRepository(db);
  }

  // -------- configuration (statutory values live in payroll_config, never in code)
  settings(): Promise<Map<string, string>> {
    return cache.getOrLoad<[string, string][]>(key('payroll', 'config'), payrollConfig.configTtl, async () => [...(await this.config.latest()).entries()]).then((e) => new Map(e));
  }
  async listConfig() { return toDtos(await this.db.query('SELECT config_key, config_value, description, effective_from FROM payroll_config ORDER BY config_key, effective_from DESC')); }
  async updateConfig(items: { key: string; value: string; description?: string }[]) {
    await this.db.tx(async (conn) => {
      for (const i of items) {
        await this.config.insert({ config_key: i.key, config_value: i.value, description: i.description ?? null, effective_from: new Date() }, conn);
        await audit(this.db, conn, 'PayrollConfig', i.key, 'CHANGED', undefined, { value: i.value });
      }
    });
    await cache.del(key('payroll', 'config'));
    return this.listConfig();
  }

  // -------- components & structures
  listComponents() { return this.components.findAll({}, { by: 'display_order' }).then((r) => toDtos(r)); }
  private compRow(dto: Row): Row { const r = toColumns(dto); for (const f of ['taxable', 'active']) if (f in r) r[f] = r[f] ? 1 : 0; return r; }
  async createComponent(dto: Row) {
    if (await this.components.findOne({ code: dto.code })) throw new ConflictError('Component code already exists');
    if (dto.calcType === 'BALANCE' && (await this.components.findOne({ calc_type: 'BALANCE', active: 1 }))) throw new BusinessRuleError('Only one BALANCE component may be active');
    const r = await this.components.insert(this.compRow(dto)); await audit(this.db, undefined, 'SalaryComponent', r.id, 'CREATED', undefined, dto); return toDto(r);
  }
  async updateComponent(id: string, dto: Row) {
    const before = await this.components.getById(id, 'Component');
    if (dto.code && dto.code !== before.code) throw new ValidationError('Component code cannot be changed');
    await this.components.update(id, this.compRow(dto)); await audit(this.db, undefined, 'SalaryComponent', id, 'UPDATED', toDto(before), dto);
    return toDto(await this.components.getById(id));
  }

  async listStructures() { const s = await this.structures.findAll({}, { by: 'name' }); return Promise.all(s.map(async (x) => ({ ...toDto(x), components: toDtos(await this.structures.components(x.id)) }))); }
  async getStructure(id: string) { const s = await this.structures.getById(id, 'Salary structure'); return { ...toDto(s), components: toDtos(await this.structures.components(id)) }; }
  private async validateStructure(items: { componentId: string; value: number }[]): Promise<void> {
    const comps = await this.components.findAll({ id: items.map((i) => i.componentId) });
    if (comps.length !== new Set(items.map((i) => i.componentId)).size) throw new ValidationError('Unknown component in structure');
    const byId = new Map(comps.map((c) => [c.id, c]));
    for (const i of items) {
      const c = byId.get(i.componentId)!;
      if (['PERCENT_OF_CTC', 'PERCENT_OF_BASIC'].includes(c.calc_type) && i.value > 100) throw new ValidationError(`${c.code}: percentage cannot exceed 100`);
    }
    const ctcPct = items.filter((i) => byId.get(i.componentId)!.calc_type === 'PERCENT_OF_CTC').reduce((a, i) => a + i.value, 0);
    if (ctcPct > 100) throw new ValidationError('Percent-of-CTC components exceed 100%');
    if (!comps.some((c) => c.code === 'BASIC')) throw new ValidationError('A structure must include the BASIC component');
  }
  async createStructure(dto: Row) {
    await this.validateStructure(dto.components);
    const id = await this.db.tx(async (conn) => {
      const s = await this.structures.insert({ name: dto.name, description: dto.description ?? null, active: dto.active ? 1 : 0 }, conn);
      await this.structures.replaceComponents(s.id, dto.components, conn);
      await audit(this.db, conn, 'SalaryStructure', s.id, 'CREATED', undefined, dto);
      return s.id as string;
    });
    return this.getStructure(id);
  }
  async updateStructure(id: string, dto: Row) {
    await this.structures.getById(id, 'Salary structure');
    if (dto.components) await this.validateStructure(dto.components);
    await this.db.tx(async (conn) => {
      await this.structures.update(id, { name: dto.name, description: dto.description, ...(dto.active !== undefined ? { active: dto.active ? 1 : 0 } : {}) }, conn);
      if (dto.components) await this.structures.replaceComponents(id, dto.components, conn);
      await audit(this.db, conn, 'SalaryStructure', id, 'UPDATED', undefined, dto);
    });
    return this.getStructure(id);
  }

  // -------- salary assignment (history rows are written by DB triggers)
  assertCanView(viewer: AuthUser, employeeId: string): void {
    if (viewer.employeeId === employeeId || hasPermission(viewer, 'PAYROLL_VIEW', 'SALARY_MANAGE')) return;
    throw new ForbiddenError('You may only view your own salary');
  }
  async assign(dto: { employeeId: string; structureId: string; annualCtc: number; effectiveFrom: string; currency: string }) {
    await this.structures.getById(dto.structureId, 'Salary structure');
    const id = await this.db.tx(async (conn) => {
      const current = await this.db.one<Row>("SELECT * FROM employee_salaries WHERE employee_id = ? AND status = 'ACTIVE' ORDER BY effective_from DESC LIMIT 1 FOR UPDATE", [dto.employeeId], conn);
      if (current) {
        if (dto.effectiveFrom <= current.effective_from) throw new BusinessRuleError('effectiveFrom must be after the current salary effective date');
        await this.salaries.update(current.id, { status: 'SUPERSEDED', effective_to: addDays(dto.effectiveFrom, -1) }, conn);
      }
      const s = await this.salaries.insert({ employee_id: dto.employeeId, structure_id: dto.structureId, annual_ctc: dto.annualCtc, currency: dto.currency, effective_from: dto.effectiveFrom, status: 'ACTIVE', version: 0 }, conn);
      await audit(this.db, conn, 'EmployeeSalary', dto.employeeId, 'ASSIGNED', undefined, { structureId: dto.structureId, effectiveFrom: dto.effectiveFrom });
      return s.id as string;
    });
    return toDto(await this.salaries.getById(id), SALARY_FIELDS);
  }
  async employeeSalary(viewer: AuthUser, employeeId: string) {
    this.assertCanView(viewer, employeeId);
    const [current, history, revisions] = await Promise.all([this.salaries.summary(employeeId), this.salaries.history(employeeId), this.salaries.revisionHistory(employeeId)]);
    return { summary: toDto(current), history: toDtos(history, SALARY_FIELDS), revisionHistory: toDtos(revisions) };
  }

  // -------- salary revisions (maker/checker)
  async requestRevision(dto: Row) {
    const current = await this.db.one<Row>("SELECT * FROM employee_salaries WHERE employee_id = ? AND status = 'ACTIVE' ORDER BY effective_from DESC LIMIT 1", [dto.employeeId]);
    if (!current) throw new BusinessRuleError('Employee has no active salary to revise');
    if (await this.revisions.findOne({ employee_id: dto.employeeId, status: 'PENDING' })) throw new ConflictError('A revision for this employee is already pending');
    if (dto.newCtc === Number(current.annual_ctc) && !dto.newStructureId) throw new BusinessRuleError('Revision does not change anything');
    const r = await this.revisions.insert({ employee_id: dto.employeeId, old_ctc: current.annual_ctc, new_ctc: dto.newCtc, new_structure_id: dto.newStructureId ?? current.structure_id, effective_from: dto.effectiveFrom, reason: dto.reason, status: 'PENDING' });
    await audit(this.db, undefined, 'SalaryRevision', r.id, 'REQUESTED', undefined, { newCtc: dto.newCtc, pct: round2(((dto.newCtc - Number(current.annual_ctc)) / Number(current.annual_ctc)) * 100) });
    return toDto(r);
  }
  listRevisions(status?: string, employeeId?: string) { return this.revisions.findAll({ ...(status ? { status } : {}), ...(employeeId ? { employee_id: employeeId } : {}) }, { by: 'created_at', dir: 'DESC' }).then((r) => toDtos(r)); }
  async decideRevision(id: string, approve: boolean, comment: string | undefined, actor: AuthUser) {
    const rev = await this.revisions.getById(id, 'Salary revision');
    if (rev.status !== 'PENDING') throw new BusinessRuleError(`Revision is already ${rev.status}`);
    if (rev.created_by === actor.username) throw new ForbiddenError('A revision cannot be approved by the person who requested it');
    await this.db.tx(async (conn) => {
      await this.revisions.update(id, { status: approve ? 'APPROVED' : 'REJECTED', decided_by: actor.userId, decided_at: new Date(), decision_comment: comment ?? null }, conn);
      if (approve) {
        const cur = await this.db.one<Row>("SELECT * FROM employee_salaries WHERE employee_id = ? AND status = 'ACTIVE' ORDER BY effective_from DESC LIMIT 1 FOR UPDATE", [rev.employee_id], conn);
        const from = !cur || rev.effective_from > cur.effective_from ? rev.effective_from : addDays(String(cur.effective_from), 1);
        if (cur) await this.salaries.update(cur.id, { status: 'SUPERSEDED', effective_to: addDays(from, -1) }, conn);
        await this.salaries.insert({ employee_id: rev.employee_id, structure_id: rev.new_structure_id ?? cur?.structure_id, annual_ctc: rev.new_ctc, currency: cur?.currency ?? 'INR', effective_from: from, status: 'ACTIVE', version: 0 }, conn);
      }
      await audit(this.db, conn, 'SalaryRevision', id, approve ? 'APPROVED' : 'REJECTED', undefined, { comment });
    });
    return toDto(await this.revisions.getById(id));
  }
}
void today;
