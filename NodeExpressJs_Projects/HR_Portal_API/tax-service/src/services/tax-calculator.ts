import { Row, round2 } from '@hr/common';

/** Pure tax computation driven entirely by the stored tax_rules (no rates in code). */
export interface TaxSlab { from: number; to: number | null; rate: number }
export interface TaxRule { regime: 'OLD' | 'NEW'; standardDeduction: number; rebateLimit: number; rebateAmount: number; cessPercent: number; slabs: TaxSlab[]; sectionLimits: Record<string, number> }
export interface DeclarationLine { section: string; amount: number }
export interface TaxResult { grossIncome: number; standardDeduction: number; totalDeductions: number; taxableIncome: number; slabTax: number; rebate: number; cess: number; totalTax: number; sectionDeductions: Record<string, number> }

export function ruleFromRow(r: Row): TaxRule {
  const parse = (v: any) => (typeof v === 'string' ? JSON.parse(v) : v);
  return {
    regime: r.regime, standardDeduction: Number(r.standard_deduction), rebateLimit: Number(r.rebate_limit), rebateAmount: Number(r.rebate_amount), cessPercent: Number(r.cess_percent),
    slabs: parse(r.slabs), sectionLimits: parse(r.section_limits) ?? {},
  };
}

export function slabTax(taxable: number, slabs: TaxSlab[]): number {
  let tax = 0;
  for (const s of slabs) {
    if (taxable <= s.from) break;
    const upper = s.to === null ? taxable : Math.min(taxable, s.to);
    tax += ((upper - s.from) * s.rate) / 100;
  }
  return tax;
}

export function computeTax(gross: number, rule: TaxRule, lines: DeclarationLine[]): TaxResult {
  const sectionDeductions: Record<string, number> = {};
  if (rule.regime === 'OLD') {
    for (const l of lines) sectionDeductions[l.section] = (sectionDeductions[l.section] ?? 0) + l.amount;
    for (const [sec, amt] of Object.entries(sectionDeductions)) { const limit = rule.sectionLimits[sec]; sectionDeductions[sec] = round2(limit !== undefined ? Math.min(amt, limit) : amt); }
  }
  const totalDeductions = round2(Object.values(sectionDeductions).reduce((a, b) => a + b, 0));
  const taxable = Math.max(0, round2(gross - rule.standardDeduction - totalDeductions));
  const base = round2(slabTax(taxable, rule.slabs));
  const rebate = taxable <= rule.rebateLimit ? Math.min(base, rule.rebateAmount) : 0;
  const cess = round2(((base - rebate) * rule.cessPercent) / 100);
  return { grossIncome: round2(gross), standardDeduction: rule.standardDeduction, totalDeductions, taxableIncome: taxable, slabTax: base, rebate: round2(rebate), cess, totalTax: round2(base - rebate + cess), sectionDeductions };
}
