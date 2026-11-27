import { AuthUser, Db, ForbiddenError, NotFoundError, Row, Topics, audit, buildEvent, enqueueOutbox, fileStorage, hasPermission, renderPdf, toDtos, logger, round2, today } from '@hr/common';
import { EntryRepository, PayslipRepository } from '../repositories/payroll.repository';

const fmt = (n: number): string => n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export class PayslipService {
  private readonly payslips: PayslipRepository; private readonly entries: EntryRepository;
  constructor(private readonly db: Db) { this.payslips = new PayslipRepository(db); this.entries = new EntryRepository(db); }

  /** Renders PDFs on worker threads (CPU-bound) in small parallel batches and stores them via the storage abstraction. */
  async generateForRun(runId: string, month: string): Promise<number> {
    const entries = await this.entries.findAll({ run_id: runId }, { by: 'employee_name' }, 5000);
    let count = 0;
    for (let i = 0; i < entries.length; i += 4) {
      const batch = entries.slice(i, i + 4);
      const done = await Promise.allSettled(batch.map((e) => this.generateOne(e, month)));
      for (const d of done) if (d.status === 'fulfilled') count++; else logger.error({ err: String(d.reason?.message ?? d.reason) }, 'payslip generation failed');
    }
    return count;
  }

  private async generateOne(e: Row, month: string): Promise<void> {
    if (await this.payslips.findOne({ entry_id: e.id })) return; // idempotent
    const lines = await this.entries.lines(e.id);
    const earn = lines.filter((l) => l.type === 'EARNING'); const ded = lines.filter((l) => l.type === 'DEDUCTION');
    const pdf = await renderPdf({
      title: 'Payslip', subtitle: `Pay period ${month}`,
      sections: [
        { heading: 'Employee', pairs: [['Name', e.employee_name ?? '-'], ['Employee code', e.employee_code ?? '-'], ['Paid days', `${e.paid_days} / ${e.working_days}`], ['Loss of pay days', String(e.lop_days)]] },
        { heading: 'Earnings', table: { columns: ['Component', 'Amount'], rows: [...earn.map((l) => [l.component_name, fmt(l.amount)]), ['Gross earnings', fmt(e.gross)]] } },
        { heading: 'Deductions', table: { columns: ['Component', 'Amount'], rows: [...ded.map((l) => [l.component_name, fmt(l.amount)]), ['Total deductions', fmt(e.deductions)]] } },
        { heading: 'Net pay', pairs: [['Net payable', fmt(round2(e.net))]] },
      ],
      footer: `System generated payslip - ${today()} - confidential`,
    });
    const fileName = `payslip-${e.employee_code ?? e.employee_id}-${month}.pdf`;
    const stored = await fileStorage.save(`payslips/${month}`, fileName, pdf);
    await this.db.tx(async (conn) => {
      const p = await this.payslips.insert({ employee_id: e.employee_id, entry_id: e.id, run_id: e.run_id, payroll_month: month, file_name: fileName, storage_path: stored.storagePath, sha256: stored.sha256, size_bytes: stored.sizeBytes, generated_at: new Date() }, conn);
      await enqueueOutbox(this.db, conn, Topics.PAYSLIP_GENERATED, buildEvent(Topics.PAYSLIP_GENERATED, 'payroll-service', {
        payslipId: p.id, employeeId: e.employee_id, month, fileName, storagePath: stored.storagePath, sha256: stored.sha256, sizeBytes: stored.sizeBytes,
      }, e.employee_id));
    });
  }

  async listForEmployee(viewer: AuthUser, employeeId: string, year?: number) {
    if (viewer.employeeId !== employeeId && !hasPermission(viewer, 'PAYSLIP_VIEW_ALL')) throw new ForbiddenError('You may only view your own payslips');
    const rows = await this.db.query<Row>(`SELECT id, employee_id, payroll_month, file_name, size_bytes, generated_at FROM payslips WHERE employee_id = ? ${year ? 'AND payroll_month LIKE ?' : ''} ORDER BY payroll_month DESC`, year ? [employeeId, `${year}-%`] : [employeeId]);
    return toDtos(rows);
  }

  async open(viewer: AuthUser, payslipId: string) {
    const p = await this.payslips.findById(payslipId);
    if (!p) throw new NotFoundError('Payslip', payslipId);
    if (p.employee_id !== viewer.employeeId && !hasPermission(viewer, 'PAYSLIP_VIEW_ALL')) throw new ForbiddenError('You may only download your own payslips');
    await audit(this.db, undefined, 'Payslip', payslipId, 'DOWNLOADED');
    return { stream: await fileStorage.open(p.storage_path), fileName: p.file_name as string, sizeBytes: Number(p.size_bytes) };
  }

  async latest(employeeId: string) {
    const r = await this.db.one<Row>('SELECT id, payroll_month, generated_at FROM payslips WHERE employee_id = ? ORDER BY payroll_month DESC LIMIT 1', [employeeId]);
    return r ? toDtos([r])[0] : null;
  }
}
