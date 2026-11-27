using System.Text.Json;
using HR.TaxService.DTOs;
using HR.TaxService.Entities;

namespace HR.TaxService.Engine;

public sealed record Slab(decimal From, decimal? To, decimal Rate);
public sealed record Rule(string Regime, decimal StandardDeduction, decimal RebateLimit, decimal RebateAmount, decimal CessPercent, List<Slab> Slabs, Dictionary<string, decimal> SectionLimits);
public sealed record DeclarationLine(string Section, decimal Amount);
public sealed record TaxResult(decimal GrossIncome, decimal StandardDeduction, decimal TotalDeductions, decimal TaxableIncome, decimal SlabTax, decimal Rebate, decimal Cess, decimal TotalTax, Dictionary<string, decimal> SectionDeductions);

/// <summary>Pure tax computation driven entirely by the stored tax_rules (no rates in code); financial-year helper included.</summary>
public static class TaxCalculator
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
    private static decimal R(decimal v) => Math.Round(v, 2, MidpointRounding.AwayFromZero);

    public static Rule FromEntity(TaxRule r) => new(r.Regime, r.StandardDeduction, r.RebateLimit, r.RebateAmount, r.CessPercent,
        JsonSerializer.Deserialize<List<Slab>>(r.Slabs, Json) ?? [], JsonSerializer.Deserialize<Dictionary<string, decimal>>(r.SectionLimits, Json) ?? []);

    /// <summary>Financial year (April-March) of a month "yyyy-MM": 2026-11 -> "2026-27".</summary>
    public static string FinancialYear(int year, int month) { var start = month >= 4 ? year : year - 1; return $"{start}-{(start + 1) % 100:D2}"; }

    public static decimal SlabTax(decimal taxable, IEnumerable<Slab> slabs)
    {
        decimal tax = 0;
        foreach (var s in slabs)
        {
            if (taxable <= s.From) break;
            var upper = s.To is null ? taxable : Math.Min(taxable, s.To.Value);
            tax += (upper - s.From) * s.Rate / 100;
        }
        return tax;
    }

    public static TaxResult Compute(decimal gross, Rule rule, IEnumerable<DeclarationLine> lines)
    {
        var sections = new Dictionary<string, decimal>();
        if (rule.Regime == "OLD")
        {
            foreach (var g in lines.GroupBy(l => l.Section))
            {
                var total = g.Sum(l => l.Amount);
                sections[g.Key] = R(rule.SectionLimits.TryGetValue(g.Key, out var limit) ? Math.Min(total, limit) : total);
            }
        }
        var deductions = R(sections.Values.Sum());
        var taxable = Math.Max(0, R(gross - rule.StandardDeduction - deductions));
        var baseTax = R(SlabTax(taxable, rule.Slabs));
        var rebate = taxable <= rule.RebateLimit ? Math.Min(baseTax, rule.RebateAmount) : 0;
        var cess = R((baseTax - rebate) * rule.CessPercent / 100);
        return new TaxResult(R(gross), rule.StandardDeduction, deductions, taxable, baseTax, R(rebate), cess, R(baseTax - rebate + cess), sections);
    }
}
