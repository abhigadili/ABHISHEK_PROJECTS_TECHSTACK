import {
  AuthUser, BusinessRuleError, Db, ForbiddenError, NotFoundError, Row, Topics, ValidationError, addDays, audit, buildEvent, enqueueOutbox, fileStorage, hasPermission, pageRequest, today,
  toDto, toDtos, toDtoPage,
} from '@hr/common';
import { documentConfig } from '../config';
import { DOC_FIELDS } from '../dto/document.dto';
import { CategoryRepository, DocumentRepository, HistoryRepository, PermissionRepository } from '../repositories/document.repository';

export interface UploadInput { buffer: Buffer; fileName: string; contentType: string }

export class DocumentService {
  private readonly docs: DocumentRepository; private readonly categories: CategoryRepository; private readonly perms: PermissionRepository; private readonly history: HistoryRepository;
  constructor(private readonly db: Db) { this.docs = new DocumentRepository(db); this.categories = new CategoryRepository(db); this.perms = new PermissionRepository(db); this.history = new HistoryRepository(db); }

  // ---------------------------------------------------------------- access control
  private roleReadable(u: AuthUser, cat: Row): boolean {
    const roles = String(cat.read_roles ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    return u.roles.some((r) => roles.includes(r)) || u.roles.includes('SUPER_ADMIN');
  }
  /** owner => always; category read roles => yes; explicit grants (employee or role, non-expired) => yes. */
  async canAccess(u: AuthUser, doc: Row, level: 'VIEW' | 'DOWNLOAD'): Promise<boolean> {
    if (doc.owner_employee_id === u.employeeId && doc.status !== 'REJECTED') return true;
    if (doc.owner_employee_id === u.employeeId) return level === 'VIEW';
    const cat = await this.categories.findById(doc.category_id);
    if (cat && this.roleReadable(u, cat)) return true;
    for (const g of await this.perms.effective(doc.id)) {
      const match = (g.grantee_type === 'EMPLOYEE' && g.grantee_id === u.employeeId) || (g.grantee_type === 'ROLE' && u.roles.includes(g.grantee_id));
      if (match && (level === 'VIEW' || g.access_level === 'DOWNLOAD')) return true;
    }
    return false;
  }

  // ---------------------------------------------------------------- categories
  async listCategories() { return toDtos(await this.categories.findAll({ active: 1 }, { by: 'name' }), ['id', 'code', 'name', 'description', 'readRoles', 'requiresVerification', 'selfUploadAllowed', 'isSensitive', 'defaultExpiryMonths']); }
  private catRow(dto: Row): Row {
    return { code: dto.code, name: dto.name, description: dto.description, read_roles: dto.readRoles?.join(','), ...(dto.requiresVerification !== undefined ? { requires_verification: dto.requiresVerification ? 1 : 0 } : {}),
      ...(dto.selfUploadAllowed !== undefined ? { self_upload_allowed: dto.selfUploadAllowed ? 1 : 0 } : {}), ...(dto.isSensitive !== undefined ? { is_sensitive: dto.isSensitive ? 1 : 0 } : {}), default_expiry_months: dto.defaultExpiryMonths, ...(dto.active !== undefined ? { active: dto.active ? 1 : 0 } : {}) };
  }
  async createCategory(dto: Row) {
    if (await this.categories.byCode(dto.code)) throw new BusinessRuleError('Category code already exists');
    return toDto(await this.categories.insert(this.catRow(dto)));
  }
  async updateCategory(id: string, dto: Row) { await this.categories.getById(id, 'Category'); await this.categories.update(id, this.catRow(dto)); return toDto(await this.categories.getById(id)); }

  // ---------------------------------------------------------------- upload / versions
  async upload(u: AuthUser, fields: Row, file: UploadInput | undefined) {
    if (!file) throw new ValidationError('A file is required (multipart field "file")');
    const cat = await this.categories.getById(fields.categoryId, 'Category');
    if (!cat.active) throw new BusinessRuleError('Category is not active');
    const hr = hasPermission(u, 'DOCUMENT_VERIFY');
    const owner = fields.ownerEmployeeId ?? u.employeeId;
    if (!owner) throw new ValidationError('ownerEmployeeId is required');
    if (owner !== u.employeeId && !hr) throw new ForbiddenError('You can only upload your own documents');
    if (owner === u.employeeId && !hr && !cat.self_upload_allowed) throw new ForbiddenError(`Employees cannot self-upload ${cat.name}; ask HR`);
    let expiry = fields.expiryDate ?? null;
    if (!expiry && cat.default_expiry_months) { const d = new Date(); d.setUTCMonth(d.getUTCMonth() + Number(cat.default_expiry_months)); expiry = d.toISOString().slice(0, 10); }
    if (expiry && expiry < today()) throw new ValidationError('The document has already expired');
    const stored = await fileStorage.save(`documents/${owner}`, file.fileName, file.buffer);
    try {
      const doc = await this.db.tx(async (conn) => {
        const prev = await this.docs.latestVersion(owner, cat.id, fields.title, conn);
        if (prev) await this.docs.update(prev.id, { current_version: 0 }, conn);
        const row = await this.docs.insert({
          owner_employee_id: owner, category_id: cat.id, title: fields.title, file_name: file.fileName.slice(0, 190), content_type: file.contentType, size_bytes: stored.sizeBytes, sha256: stored.sha256, storage_path: stored.storagePath,
          expiry_date: expiry, source: fields.source, status: cat.requires_verification ? 'UPLOADED' : 'APPROVED', current_version: 1, version_number: prev ? Number(prev.version_number) + 1 : 1, previous_version_id: prev?.id ?? null, uploaded_by: u.userId, optimistic_version: 0,
        }, conn);
        await this.history.add(conn, row.id, 'UPLOADED', `v${row.version_number} ${file.fileName}`); await audit(this.db, conn, 'Document', row.id, 'UPLOADED', undefined, { category: cat.code, owner });
        return row;
      });
      return toDto(doc, DOC_FIELDS);
    } catch (e) { await fileStorage.remove(stored.storagePath).catch(() => undefined); throw e; }
  }

  /** Registers a file another service already wrote to shared storage (payslips, tax statements, exit letters). */
  async registerSystemDocument(p: { ownerEmployeeId: string; categoryCode: string; title: string; fileName: string; storagePath: string; sha256: string; sizeBytes: number; source: 'PAYSLIP' | 'TAX' | 'EXIT'; contentType?: string }, conn: any): Promise<void> {
    const cat = await this.categories.byCode(p.categoryCode);
    if (!cat) return;
    const dup = await this.db.one('SELECT id FROM documents WHERE storage_path = ?', [p.storagePath], conn);
    if (dup) return;
    const prev = await this.docs.latestVersion(p.ownerEmployeeId, cat.id, p.title, conn);
    if (prev) await this.docs.update(prev.id, { current_version: 0 }, conn);
    const row = await this.docs.insert({ owner_employee_id: p.ownerEmployeeId, category_id: cat.id, title: p.title, file_name: p.fileName, content_type: p.contentType ?? 'application/pdf', size_bytes: p.sizeBytes, sha256: p.sha256, storage_path: p.storagePath, source: p.source, status: 'APPROVED', current_version: 1, version_number: prev ? Number(prev.version_number) + 1 : 1, previous_version_id: prev?.id ?? null, uploaded_by: 'system', optimistic_version: 0 }, conn);
    await this.history.add(conn, row.id, 'REGISTERED', p.source);
  }

  // ---------------------------------------------------------------- read / download
  async list(u: AuthUser, q: Row) {
    const where: Row = { current_version: 1 }; if (q.categoryId) where.category_id = q.categoryId; if (q.status) where.status = q.status; if (q.source) where.source = q.source;
    const hr = hasPermission(u, 'DOCUMENT_VERIFY');
    if (hr) { if (q.ownerEmployeeId) where.owner_employee_id = q.ownerEmployeeId; }
    else if (q.ownerEmployeeId && q.ownerEmployeeId !== u.employeeId) {
      // category-role holders (e.g. payroll for payslips) may list another employee's documents in categories they can read
      const cats = (await this.categories.findAll({}, undefined, 200)).filter((c) => this.roleReadable(u, c)).map((c) => c.id as string);
      if (!cats.length) throw new ForbiddenError('You may only list your own documents');
      where.owner_employee_id = q.ownerEmployeeId; where.category_id = q.categoryId && cats.includes(q.categoryId) ? q.categoryId : cats;
    } else where.owner_employee_id = u.employeeId ?? '-';
    return toDtoPage(await this.docs.page(where, pageRequest(q), q.q), DOC_FIELDS);
  }

  async get(u: AuthUser, id: string) {
    const d = await this.docs.getById(id, 'Document');
    if (!(await this.canAccess(u, d, 'VIEW'))) throw new ForbiddenError('You are not allowed to view this document');
    const [versions, history] = await Promise.all([this.docs.versions(d.owner_employee_id, d.category_id, d.title), this.history.findAll({ document_id: id }, { by: 'created_at' })]);
    return { ...toDto(d, DOC_FIELDS), versions: toDtos(versions, ['id', 'versionNumber', 'currentVersion', 'status', 'createdAt', 'fileName']), history: toDtos(history) };
  }

  async download(u: AuthUser, id: string) {
    const d = await this.docs.getById(id, 'Document');
    if (!(await this.canAccess(u, d, 'DOWNLOAD'))) throw new ForbiddenError('You are not allowed to download this document');
    await this.history.add(undefined, id, 'DOWNLOADED', u.username); await audit(this.db, undefined, 'Document', id, 'DOWNLOADED');
    return { stream: await fileStorage.open(d.storage_path), fileName: d.file_name as string, contentType: d.content_type as string, sizeBytes: Number(d.size_bytes) };
  }

  // ---------------------------------------------------------------- verification workflow
  private async decide(u: AuthUser, id: string, to: 'VERIFIED' | 'APPROVED' | 'REJECTED', reason?: string) {
    const d = await this.docs.getById(id, 'Document');
    if (d.owner_employee_id === u.employeeId) throw new ForbiddenError('You cannot verify your own document');
    const allowed: Record<string, string[]> = { VERIFIED: ['UPLOADED'], APPROVED: ['UPLOADED', 'VERIFIED'], REJECTED: ['UPLOADED', 'VERIFIED'] };
    if (!allowed[to].includes(d.status)) throw new BusinessRuleError(`A ${d.status} document cannot be moved to ${to}`);
    await this.db.tx(async (conn) => {
      await this.docs.update(id, { status: to, decided_by: u.userId, decided_at: new Date(), rejection_reason: to === 'REJECTED' ? reason : null }, conn);
      await this.history.add(conn, id, to, reason); await audit(this.db, conn, 'Document', id, to, { status: d.status }, { status: to, reason });
      if (to === 'REJECTED') await enqueueOutbox(this.db, conn, Topics.NOTIFICATION_REQUESTED, buildEvent(Topics.NOTIFICATION_REQUESTED, 'document-service', { type: 'DOCUMENT_REJECTED', recipientEmployeeId: d.owner_employee_id, subject: `Document rejected: ${d.title}`, body: `Reason: ${reason}`, referenceType: 'Document', referenceId: id }, d.owner_employee_id));
    });
    return toDto(await this.docs.getById(id), DOC_FIELDS);
  }
  verify = (u: AuthUser, id: string) => this.decide(u, id, 'VERIFIED');
  approve = (u: AuthUser, id: string) => this.decide(u, id, 'APPROVED');
  reject = (u: AuthUser, id: string, reason: string) => this.decide(u, id, 'REJECTED', reason);

  async remove(u: AuthUser, id: string) {
    const d = await this.docs.getById(id, 'Document');
    if (d.owner_employee_id !== u.employeeId && !hasPermission(u, 'DOCUMENT_VERIFY')) throw new ForbiddenError();
    if (['PAYSLIP', 'EXIT'].includes(d.source) ) throw new BusinessRuleError('System generated documents cannot be deleted');
    if (d.owner_employee_id === u.employeeId && d.status !== 'UPLOADED' && !hasPermission(u, 'DOCUMENT_VERIFY')) throw new BusinessRuleError('Only unverified documents can be deleted by the owner');
    await this.docs.remove(id); await this.history.add(undefined, id, 'DELETED'); await audit(this.db, undefined, 'Document', id, 'DELETED');
  }

  // ---------------------------------------------------------------- permissions
  async grant(u: AuthUser, id: string, dto: Row) {
    const d = await this.docs.getById(id, 'Document');
    if (d.owner_employee_id !== u.employeeId && !hasPermission(u, 'DOCUMENT_VERIFY')) throw new ForbiddenError('Only the owner or HR can share a document');
    const cat = await this.categories.getById(d.category_id);
    if (cat.is_sensitive && !hasPermission(u, 'DOCUMENT_VERIFY')) throw new ForbiddenError('Sensitive documents can only be shared by HR');
    const g = await this.perms.insert({ document_id: id, grantee_type: dto.granteeType, grantee_id: dto.granteeId, access_level: dto.accessLevel, expires_at: dto.expiresAt ? new Date(dto.expiresAt) : null });
    await this.history.add(undefined, id, 'ACCESS_GRANTED', `${dto.granteeType}:${dto.granteeId}`); await audit(this.db, undefined, 'Document', id, 'ACCESS_GRANTED', undefined, dto);
    return toDto(g);
  }
  async listGrants(u: AuthUser, id: string) { const d = await this.docs.getById(id, 'Document'); if (d.owner_employee_id !== u.employeeId && !hasPermission(u, 'DOCUMENT_VERIFY')) throw new ForbiddenError(); return toDtos(await this.perms.findAll({ document_id: id })); }
  async revoke(u: AuthUser, id: string, grantId: string) {
    const d = await this.docs.getById(id, 'Document');
    if (d.owner_employee_id !== u.employeeId && !hasPermission(u, 'DOCUMENT_VERIFY')) throw new ForbiddenError();
    const g = await this.perms.findOne({ id: grantId, document_id: id }); if (!g) throw new NotFoundError('Grant', grantId);
    await this.perms.remove(grantId); await this.history.add(undefined, id, 'ACCESS_REVOKED', `${g.grantee_type}:${g.grantee_id}`);
  }

  // ---------------------------------------------------------------- expiry
  async expiring(days: number) { return toDtos(await this.docs.expiring(today(), addDays(today(), days)), DOC_FIELDS); }
  /** Sends expiry notifications (deduplicated by Redis in the notification service). */
  async remindExpiring(): Promise<number> {
    const list = await this.docs.expiring(today(), addDays(today(), documentConfig.expiryWarningDays));
    await this.db.tx(async (conn) => {
      for (const d of list) await enqueueOutbox(this.db, conn, Topics.NOTIFICATION_REQUESTED, buildEvent(Topics.NOTIFICATION_REQUESTED, 'document-service', { type: 'DOCUMENT_EXPIRING', recipientEmployeeId: d.owner_employee_id, subject: `Document expiring: ${d.title}`, body: `"${d.title}" expires on ${d.expiry_date}. Please upload a renewed copy.`, dedupeKey: `docexp:${d.id}:${today()}`, referenceType: 'Document', referenceId: d.id }, d.owner_employee_id));
    });
    return list.length;
  }

  /** Seeds categories that other services depend on (idempotent, additive). */
  async ensureCategories(): Promise<void> {
    const need: [string, string, string, number][] = [['PAYSLIP', 'Payslip', 'PAYROLL_ADMIN,FINANCE_ADMIN,SUPER_ADMIN', 0], ['TAX', 'Tax document', 'FINANCE_ADMIN,HR_ADMIN,SUPER_ADMIN', 0], ['EXIT', 'Exit document', 'HR_ADMIN,SUPER_ADMIN', 0], ['LEAVE_ATTACHMENT', 'Leave attachment', 'HR_ADMIN,SUPER_ADMIN', 1]];
    for (const [code, name, roles, self] of need) if (!(await this.categories.byCode(code))) await this.categories.insert({ code, name, read_roles: roles, requires_verification: 0, self_upload_allowed: self, is_sensitive: 0, active: 1 });
  }
}
