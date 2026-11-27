import { Db, Repository, Row } from '@hr/common';

export class CategoryRepository extends Repository {
  constructor(db: Db) { super(db, 'document_categories', { softDelete: true }); }
  byCode(code: string): Promise<Row | null> { return this.findOne({ code }); }
}
export class DocumentRepository extends Repository {
  constructor(db: Db) { super(db, 'documents', { softDelete: true, searchable: ['title', 'file_name'], sortable: ['created_at', 'title', 'expiry_date', 'status'] }); }
  latestVersion(owner: string, categoryId: string, title: string, conn?: any): Promise<Row | null> {
    return this.db.one('SELECT * FROM documents WHERE owner_employee_id = ? AND category_id = ? AND title = ? AND deleted = 0 AND current_version = 1 LIMIT 1 FOR UPDATE', [owner, categoryId, title], conn);
  }
  versions(owner: string, categoryId: string, title: string): Promise<Row[]> {
    return this.db.query('SELECT * FROM documents WHERE owner_employee_id = ? AND category_id = ? AND title = ? AND deleted = 0 ORDER BY version_number DESC', [owner, categoryId, title]);
  }
  expiring(from: string, to: string): Promise<Row[]> {
    return this.db.query("SELECT * FROM documents WHERE deleted = 0 AND current_version = 1 AND expiry_date BETWEEN ? AND ? AND status <> 'REJECTED' ORDER BY expiry_date", [from, to]);
  }
}
export class PermissionRepository extends Repository {
  constructor(db: Db) { super(db, 'document_permissions'); }
  effective(documentId: string): Promise<Row[]> { return this.db.query('SELECT * FROM document_permissions WHERE document_id = ? AND (expires_at IS NULL OR expires_at > ?)', [documentId, new Date()]); }
}
export class HistoryRepository extends Repository {
  constructor(db: Db) { super(db, 'document_history'); }
  add(conn: any, documentId: string, action: string, detail?: string) { return this.insert({ document_id: documentId, action, detail: detail ?? null }, conn); }
}
