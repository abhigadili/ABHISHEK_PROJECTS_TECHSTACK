import {
  BusinessRuleError, ConflictError, Db, NotFoundError, Row, ValidationError, audit, cache, key, pageRequest, toColumns, toDto, toDtoPage, toDtos, today, requestContext,
} from '@hr/common';
import { orgConfig } from '../config';
import { REFERENCE, ReferenceKind } from '../dto/organization.dto';
import { OrgGraphRepository, ReferenceRepository } from '../repositories/organization.repository';

interface TreeNode { id: string; label: string; type: string; code?: string; designationId?: string | null; status?: string; children: TreeNode[]; headcount?: number }

export class ReferenceService {
  constructor(private readonly db: Db) {}
  private repo(kind: ReferenceKind) { const d = REFERENCE[kind]; return new ReferenceRepository(this.db, d.table, [...d.search]); }

  async list(kind: ReferenceKind, q: Record<string, any>) {
    const where: Row = {};
    if (q.active !== undefined) where.active = q.active === 'true' ? 1 : 0;
    const cols = await this.repo(kind).columns();
    if (!cols.has('active')) delete where.active;
    return toDtoPage(await this.repo(kind).page(where, pageRequest({ ...q, sort: q.sort ?? undefined }), q.q));
  }

  async get(kind: ReferenceKind, id: string) {
    return cache.getOrLoad(key('org', kind, id), 600, async () => toDto(await this.repo(kind).getById(id, REFERENCE[kind].label)));
  }

  async create(kind: ReferenceKind, dto: Row) {
    const def = REFERENCE[kind]; const repo = this.repo(kind);
    for (const u of def.unique) if (await repo.findOne({ [u]: dto[u] })) throw new ConflictError(`${def.label} with this ${u} already exists`);
    await this.validateLinks(kind, dto);
    const row = await this.db.tx(async (conn) => {
      const r = await repo.insert(this.toRow(dto), conn);
      await audit(this.db, conn, def.label, r.id, 'CREATED', undefined, dto);
      return r;
    });
    await this.evict();
    return toDto(row);
  }

  async update(kind: ReferenceKind, id: string, dto: Row) {
    const def = REFERENCE[kind]; const repo = this.repo(kind);
    const before = await repo.getById(id, def.label);
    for (const u of def.unique) {
      if (dto[u] !== undefined && dto[u] !== before[u]) { const dup = await repo.findOne({ [u]: dto[u] }); if (dup) throw new ConflictError(`${def.label} with this ${u} already exists`); }
    }
    await this.validateLinks(kind, dto, id);
    await this.db.tx(async (conn) => {
      await repo.update(id, this.toRow(dto), conn);
      await audit(this.db, conn, def.label, id, 'UPDATED', before, dto);
    });
    await this.evict();
    return toDto(await repo.getById(id, def.label));
  }

  async remove(kind: ReferenceKind, id: string) {
    const def = REFERENCE[kind]; const repo = this.repo(kind);
    await repo.getById(id, def.label);
    if (kind === 'departments') {
      const used = await this.db.scalar<number>("SELECT COUNT(*) FROM org_employee_nodes WHERE department_id = ? AND status IN ('ACTIVE','ON_NOTICE')", [id]);
      const kids = await this.db.scalar<number>('SELECT COUNT(*) FROM departments WHERE parent_id = ? AND deleted = 0', [id]);
      if (Number(used) > 0 || Number(kids) > 0) throw new BusinessRuleError('Department still has active employees or sub-departments');
    }
    if (kind === 'designations' || kind === 'locations') {
      const col = kind === 'designations' ? 'designation_id' : 'location_id';
      const used = await this.db.scalar<number>(`SELECT COUNT(*) FROM org_employee_nodes WHERE ${col} = ? AND status IN ('ACTIVE','ON_NOTICE')`, [id]);
      if (Number(used) > 0) throw new BusinessRuleError(`${def.label} is still assigned to active employees`);
    }
    await this.db.tx(async (conn) => { await repo.remove(id, conn); await audit(this.db, conn, def.label, id, 'DELETED'); });
    await this.evict();
  }

  private toRow(dto: Row): Row {
    const row = toColumns(dto);
    if ('active' in row) row.active = row.active ? 1 : 0;
    return row;
  }

  private async validateLinks(kind: ReferenceKind, dto: Row, selfId?: string): Promise<void> {
    if (kind === 'departments') {
      if (dto.parentId) {
        if (dto.parentId === selfId) throw new BusinessRuleError('A department cannot be its own parent');
        await new ReferenceRepository(this.db, 'departments', []).getById(dto.parentId, 'Parent department');
        if (selfId) {
          const cyc = await this.db.query(`WITH RECURSIVE up AS (SELECT id, parent_id FROM departments WHERE id = ? UNION ALL SELECT d.id, d.parent_id FROM departments d JOIN up ON d.id = up.parent_id) SELECT id FROM up WHERE id = ?`, [dto.parentId, selfId]);
          if (cyc.length) throw new BusinessRuleError('Department hierarchy would contain a cycle');
        }
      }
      if (dto.businessUnitId) await new ReferenceRepository(this.db, 'business_units', []).getById(dto.businessUnitId, 'Business unit');
    }
    if (kind === 'business-units' && dto.organizationId) await new ReferenceRepository(this.db, 'organizations', []).getById(dto.organizationId, 'Organization');
    if (kind === 'designations' && dto.jobGradeId) await new ReferenceRepository(this.db, 'job_grades', []).getById(dto.jobGradeId, 'Job grade');
  }

  private async evict(): Promise<void> { await cache.evictPrefix(key('org')); }
}

export class OrgStructureService {
  private readonly graph: OrgGraphRepository;
  constructor(private readonly db: Db) { this.graph = new OrgGraphRepository(db); }

  /** Hierarchical org chart built in-memory from the employee read model (cached). */
  async chart(type: 'reporting' | 'departments', rootId: string | undefined, depth: number): Promise<TreeNode[]> {
    return cache.getOrLoad(key('org', 'chart', type, rootId ?? 'all', depth), orgConfig.chartTtl, async () => {
      if (type === 'departments') return this.departmentTree(rootId, depth);
      const nodes = await this.graph.nodes();
      const byId = new Map<string, TreeNode>(nodes.map((n) => [n.employee_id, { id: n.employee_id, label: n.full_name, type: 'EMPLOYEE', code: n.employee_code, designationId: n.designation_id, status: n.status, children: [] }]));
      const roots: TreeNode[] = [];
      for (const n of nodes) {
        const node = byId.get(n.employee_id)!;
        const parent = n.manager_id ? byId.get(n.manager_id) : undefined;
        if (parent) parent.children.push(node); else roots.push(node);
      }
      const prune = (t: TreeNode, d: number): TreeNode => ({ ...t, children: d >= depth ? [] : t.children.map((c) => prune(c, d + 1)) });
      if (rootId) { const r = byId.get(rootId); if (!r) throw new NotFoundError('Employee', rootId); return [prune(r, 1)]; }
      return roots.map((r) => prune(r, 1));
    });
  }

  private async departmentTree(rootId: string | undefined, depth: number): Promise<TreeNode[]> {
    const [deps, counts] = await Promise.all([this.graph.departments(), this.graph.departmentHeadcounts()]);
    const hc = new Map<string, number>(counts.map((c) => [c.department_id, Number(c.headcount)]));
    const map = new Map<string, TreeNode>(deps.map((d) => [d.id, { id: d.id, label: d.name, code: d.code, type: 'DEPARTMENT', headcount: hc.get(d.id) ?? 0, children: [] }]));
    const roots: TreeNode[] = [];
    for (const d of deps) { const n = map.get(d.id)!; const p = d.parent_id ? map.get(d.parent_id) : undefined; if (p) p.children.push(n); else roots.push(n); }
    const prune = (t: TreeNode, d: number): TreeNode => ({ ...t, children: d >= depth ? [] : t.children.map((c) => prune(c, d + 1)) });
    if (rootId) { const r = map.get(rootId); if (!r) throw new NotFoundError('Department', rootId); return [prune(r, 1)]; }
    return roots.map((r) => prune(r, 1));
  }

  async departmentEmployees(id: string, page: number, size: number) {
    await new ReferenceRepository(this.db, 'departments', []).getById(id, 'Department');
    const [total, rows] = await this.graph.departmentEmployees(id, page, size);
    return { content: toDtos(rows), page, size, totalElements: Number(total), totalPages: Math.ceil(Number(total) / size) };
  }

  async reportingChain(id: string) { return toDtos(await this.graph.reportingChain(id)); }
  async subordinates(id: string) { return toDtos(await this.graph.subordinates(id)); }
  async directReports(id: string) { return toDtos((await this.graph.nodes()).filter((n) => n.manager_id === id)); }
  async reportingHistory(id: string) { return toDtos(await this.graph.lines(id)); }
  async details(id: string) { const d = await this.graph.details(id); if (!d) throw new NotFoundError('Employee', id); return toDto(d); }

  /** Records a manager change in reporting_lines (closing the previous line). Employee Service remains the owner of employees.manager_id. */
  async recordManagerChange(employeeId: string, managerId: string | null, effectiveFrom: string, conn?: any): Promise<void> {
    const current = await this.graph.currentLine(employeeId);
    if (current && (current.manager_id ?? null) === managerId) return;
    const at = new Date(`${effectiveFrom}T00:00:00`);
    if (current) await this.db.exec('UPDATE reporting_lines SET effective_to = ?, updated_at = ? WHERE id = ?', [at, new Date(), current.id], conn);
    await new ReferenceRepository(this.db, 'reporting_lines', []).insert({ employee_id: employeeId, manager_id: managerId, effective_from: at }, conn);
  }

  async assertNoCycle(employeeId: string, managerId: string): Promise<void> {
    if (employeeId === managerId) throw new BusinessRuleError('An employee cannot report to themselves');
    const chain = await this.graph.reportingChain(managerId);
    if (chain.some((c) => c.employee_id === employeeId)) throw new BusinessRuleError('Manager assignment would create a reporting cycle');
    if (!(await this.graph.node(managerId))) throw new NotFoundError('Manager', managerId);
  }

  async cacheEvict(): Promise<void> { await cache.evictPrefix(key('org')); }
  async audit(entity: string, id: string, action: string, prev?: unknown, next?: unknown) { await audit(this.db, undefined, entity, id, action, prev, next); }
}
void ValidationError; void today; void requestContext;
