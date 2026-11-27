import { BusinessRuleError, ConflictError, Db, Row, audit, toColumns, toDto, toDtos, cache, key } from '@hr/common';
import { LeaveTypeRepository, PolicyRepository } from '../repositories/leave.repository';

export class LeaveAdminService {
  private readonly types: LeaveTypeRepository;
  private readonly policies: PolicyRepository;
  constructor(private readonly db: Db) { this.types = new LeaveTypeRepository(db); this.policies = new PolicyRepository(db); }

  // ---- leave types
  listTypes() { return cache.getOrLoad(key('leave', 'types'), 600, async () => toDtos(await this.types.findAll({ active: 1 }, { by: 'code' }))); }
  async getType(id: string) { return toDto(await this.types.getById(id, 'Leave type')); }
  private typeRow(dto: Row): Row { const r = toColumns(dto); for (const f of ['paid', 'balance_tracked', 'half_day_allowed', 'requires_hr_approval', 'active']) if (f in r) r[f] = r[f] ? 1 : 0; return r; }
  async createType(dto: Row) {
    if (await this.types.findOne({ code: dto.code })) throw new ConflictError('Leave type code already exists');
    const r = await this.types.insert(this.typeRow(dto));
    await audit(this.db, undefined, 'LeaveType', r.id, 'CREATED', undefined, dto); await cache.del(key('leave', 'types'));
    return toDto(r);
  }
  async updateType(id: string, dto: Row) {
    const before = await this.types.getById(id, 'Leave type');
    if (dto.code && dto.code !== before.code && (await this.types.findOne({ code: dto.code }))) throw new ConflictError('Leave type code already exists');
    await this.types.update(id, this.typeRow(dto));
    await audit(this.db, undefined, 'LeaveType', id, 'UPDATED', toDto(before), dto); await cache.del(key('leave', 'types'));
    return this.getType(id);
  }
  async deleteType(id: string) {
    await this.types.getById(id, 'Leave type');
    const used = await this.db.scalar<number>('SELECT COUNT(*) FROM leave_applications WHERE leave_type_id = ?', [id]);
    if (Number(used) > 0) throw new BusinessRuleError('Leave type has applications; deactivate it instead');
    await this.types.remove(id); await cache.del(key('leave', 'types'));
  }

  // ---- policies
  async listPolicies() {
    const ps = await this.policies.findAll({}, { by: 'name' });
    return Promise.all(ps.map(async (p) => ({ ...toDto(p), entitlements: toDtos(await this.policies.entitlements(p.id)) })));
  }
  async getPolicy(id: string) { const p = await this.policies.getById(id, 'Leave policy'); return { ...toDto(p), entitlements: toDtos(await this.policies.entitlements(id)) }; }
  async createPolicy(dto: Row) {
    const id = await this.db.tx(async (conn) => {
      if (dto.isDefault) await this.db.exec('UPDATE leave_policies SET is_default = 0', [], conn);
      const p = await this.policies.insert({ name: dto.name, description: dto.description ?? null, hr_approval_threshold_days: dto.hrApprovalThresholdDays, is_default: dto.isDefault ? 1 : 0, active: dto.active ? 1 : 0 }, conn);
      await this.policies.replaceEntitlements(p.id, dto.entitlements, conn);
      await audit(this.db, conn, 'LeavePolicy', p.id, 'CREATED', undefined, dto);
      return p.id as string;
    });
    return this.getPolicy(id);
  }
  async updatePolicy(id: string, dto: Row) {
    const before = await this.getPolicy(id);
    await this.db.tx(async (conn) => {
      if (dto.isDefault) await this.db.exec('UPDATE leave_policies SET is_default = 0', [], conn);
      await this.policies.update(id, { name: dto.name, description: dto.description, hr_approval_threshold_days: dto.hrApprovalThresholdDays, ...(dto.isDefault !== undefined ? { is_default: dto.isDefault ? 1 : 0 } : {}), ...(dto.active !== undefined ? { active: dto.active ? 1 : 0 } : {}) }, conn);
      if (dto.entitlements) await this.policies.replaceEntitlements(id, dto.entitlements, conn);
      await audit(this.db, conn, 'LeavePolicy', id, 'UPDATED', before, dto);
    });
    return this.getPolicy(id);
  }
  async deletePolicy(id: string) {
    const p = await this.policies.getById(id, 'Leave policy');
    if (p.is_default) throw new BusinessRuleError('The default policy cannot be deleted');
    await this.policies.remove(id);
  }
}
