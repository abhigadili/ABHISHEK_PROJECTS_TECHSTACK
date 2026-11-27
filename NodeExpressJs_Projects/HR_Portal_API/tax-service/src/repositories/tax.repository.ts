import { Db, Repository, Row } from '@hr/common';

export class RuleRepository extends Repository {
  constructor(db: Db) { super(db, 'tax_rules'); }
  find(fy: string, regime: string): Promise<Row | null> { return this.db.one('SELECT * FROM tax_rules WHERE financial_year = ? AND regime = ? AND active = 1 LIMIT 1', [fy, regime]); }
}
export class DeclarationRepository extends Repository {
  constructor(db: Db) { super(db, 'tax_declarations', { sortable: ['created_at', 'financial_year', 'status', 'submitted_at'], searchable: ['employee_name'] }); }
  history(id: string): Promise<Row[]> { return this.db.query('SELECT * FROM tax_declaration_history WHERE declaration_id = ? ORDER BY created_at', [id]); }
}
export class InvestmentRepository extends Repository {
  constructor(db: Db) { super(db, 'investment_declarations'); }
  totals(declarationId: string, conn?: any): Promise<Row | null> {
    return this.db.one('SELECT COALESCE(SUM(declared_amount),0) AS declared, COALESCE(SUM(approved_amount),0) AS approved FROM investment_declarations WHERE declaration_id = ?', [declarationId], conn);
  }
}
export class ProofRepository extends Repository { constructor(db: Db) { super(db, 'tax_proofs'); } }
export class ComputationRepository extends Repository { constructor(db: Db) { super(db, 'tax_computations'); } }
export class TdsRepository extends Repository {
  constructor(db: Db) { super(db, 'monthly_tds'); }
  paidBefore(employeeId: string, fy: string, month: string): Promise<number> {
    return this.db.scalar<number>('SELECT COALESCE(SUM(tds),0) FROM monthly_tds WHERE employee_id = ? AND financial_year = ? AND tds_month < ?', [employeeId, fy, month]).then((v) => Number(v ?? 0));
  }
}
export class TaxDocumentRepository extends Repository { constructor(db: Db) { super(db, 'tax_documents'); } }
export class TaxEmployeeRepository extends Repository { constructor(db: Db) { super(db, 'tax_employees', { pk: ['employee_id'] }); } }
