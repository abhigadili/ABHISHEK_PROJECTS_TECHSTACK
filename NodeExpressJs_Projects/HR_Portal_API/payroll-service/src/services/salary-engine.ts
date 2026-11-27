import { Row, round2 } from '@hr/common';

/** Typed, configuration-driven salary calculation engine (no statutory value is hard-coded here). */
export type LineType = 'EARNING' | 'DEDUCTION';
export interface Line { code: string; name: string; type: LineType; amount: number; note?: string }

export interface StructureComponent { code: string; name: string; type: LineType; calcType: string; value: number; displayOrder: number }
export interface PayrollSettings {
  pfEnabled: boolean; pfEmployeePercent: number; pfWageCeiling: number; ptSlabs: { upTo: number | null; amount: number }[];
}
export interface AttendanceInput { workingDays: number; paidDays: number; lopDays: number; overtimeMinutes: number }
export interface EngineInput {
  monthlyCtc: number; components: StructureComponent[]; settings: PayrollSettings; attendance: AttendanceInput;
  overtimePay: number; tds: number;
  adjustments: { type: string; amount: number; description?: string }[];
  loanEmi: number;
}

type Strategy = (c: StructureComponent, ctx: Ctx) => number;
interface Ctx { monthlyCtc: number; basic: number; fixedEarnings: number; gross: number; factor: number; input: EngineInput }

/** Strategy per calc_type; earnings first, then deductions that depend on the computed basic/gross. */
const EARNING_STRATEGIES: Record<string, Strategy> = {
  PERCENT_OF_CTC: (c, x) => (x.monthlyCtc * c.value) / 100,
  PERCENT_OF_BASIC: (c, x) => (x.basic * c.value) / 100,
  FIXED: (c) => c.value,
};

const sumBy = <T>(xs: T[], f: (x: T) => number): number => xs.reduce((a, x) => a + f(x), 0);

export function calculateSalary(input: EngineInput): Line[] {
  const { components, attendance: att, settings } = input;
  const factor = att.workingDays > 0 ? Math.min(1, Math.max(0, att.paidDays / att.workingDays)) : 1;
  const ordered = [...components].sort((a, b) => a.displayOrder - b.displayOrder);
  const ctx: Ctx = { monthlyCtc: input.monthlyCtc, basic: 0, fixedEarnings: 0, gross: 0, factor, input };
  const lines: Line[] = [];

  // 1) full-month earnings that are derivable (percent of CTC / basic, fixed)
  const full = new Map<string, number>();
  for (const c of ordered.filter((c) => c.type === 'EARNING' && EARNING_STRATEGIES[c.calcType])) {
    const amt = EARNING_STRATEGIES[c.calcType](c, ctx);
    if (c.calcType === 'PERCENT_OF_CTC' && c.code === 'BASIC') ctx.basic = amt;
    full.set(c.code, amt);
    ctx.fixedEarnings += amt;
  }
  if (!ctx.basic) ctx.basic = full.get('BASIC') ?? 0;
  // percent-of-basic components were computed before basic was known if ordered earlier; recompute defensively
  for (const c of ordered.filter((c) => c.calcType === 'PERCENT_OF_BASIC')) { const prev = full.get(c.code) ?? 0; const amt = (ctx.basic * c.value) / 100; ctx.fixedEarnings += amt - prev; full.set(c.code, amt); }
  // 2) BALANCE component soaks up the rest of the monthly CTC
  for (const c of ordered.filter((c) => c.type === 'EARNING' && c.calcType === 'BALANCE')) full.set(c.code, Math.max(0, input.monthlyCtc - ctx.fixedEarnings));

  for (const c of ordered.filter((c) => c.type === 'EARNING' && full.has(c.code))) {
    lines.push({ code: c.code, name: c.name, type: 'EARNING', amount: round2((full.get(c.code) ?? 0) * factor), note: factor < 1 ? `prorated ${att.paidDays}/${att.workingDays}` : undefined });
  }
  const proratedBasic = round2(ctx.basic * factor);

  // 3) variable earnings: overtime + approved adjustments
  const ot = ordered.find((c) => c.calcType === 'VARIABLE' && c.code === 'OVERTIME');
  if (ot && input.overtimePay > 0) lines.push({ code: ot.code, name: ot.name, type: 'EARNING', amount: round2(input.overtimePay), note: `${att.overtimeMinutes} min` });
  const earningAdj: Record<string, string> = { BONUS: 'Bonus', ALLOWANCE: 'Allowance', ARREARS: 'Arrears', REIMBURSEMENT: 'Reimbursement', FINAL_SETTLEMENT: 'Final settlement' };
  for (const a of input.adjustments.filter((a) => a.type in earningAdj)) lines.push({ code: a.type, name: earningAdj[a.type], type: 'EARNING', amount: round2(a.amount), note: a.description });

  ctx.gross = round2(sumBy(lines, (l) => l.amount));

  // 4) deductions
  for (const c of ordered.filter((c) => c.type === 'DEDUCTION')) {
    let amt = 0;
    switch (c.calcType) {
      case 'STATUTORY_PF': amt = settings.pfEnabled ? (Math.min(proratedBasic, settings.pfWageCeiling) * settings.pfEmployeePercent) / 100 : 0; break;
      case 'SLAB_PT': { const slab = settings.ptSlabs.find((s) => s.upTo === null || ctx.gross <= s.upTo); amt = slab?.amount ?? 0; break; }
      case 'TAX_TDS': amt = input.tds; break;
      case 'VARIABLE': amt = sumBy(input.adjustments.filter((a) => a.type === 'OTHER_DEDUCTION'), (a) => a.amount); break;
      case 'FIXED': amt = c.value; break;
      default: amt = 0;
    }
    if (amt > 0) lines.push({ code: c.code, name: c.name, type: 'DEDUCTION', amount: round2(amt) });
  }
  if (input.loanEmi > 0) lines.push({ code: 'LOAN', name: 'Loan recovery', type: 'DEDUCTION', amount: round2(input.loanEmi) });
  return lines;
}

export const totals = (lines: Line[]) => {
  const gross = round2(sumBy(lines.filter((l) => l.type === 'EARNING'), (l) => l.amount));
  const deductions = round2(sumBy(lines.filter((l) => l.type === 'DEDUCTION'), (l) => l.amount));
  return { gross, deductions, net: round2(gross - deductions) };
};

export function parseSettings(cfg: Map<string, string>): PayrollSettings {
  const num = (k: string, d: number): number => { const v = Number(cfg.get(k)); return Number.isFinite(v) ? v : d; };
  let slabs: PayrollSettings['ptSlabs'] = [];
  try { slabs = JSON.parse(cfg.get('statutory.pt.slabs') ?? '[]'); } catch { slabs = []; }
  return { pfEnabled: (cfg.get('statutory.pf.enabled') ?? 'false') === 'true', pfEmployeePercent: num('statutory.pf.employee_percent', 0), pfWageCeiling: num('statutory.pf.wage_ceiling', Number.MAX_SAFE_INTEGER), ptSlabs: slabs };
}
export type { Row };
