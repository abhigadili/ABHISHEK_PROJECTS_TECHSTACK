using System.Globalization;
using System.Text.Json;
using HR.Common.Cache;
using HR.Common.Common;
using HR.Common.Data;
using HR.Common.Messaging;
using HR.Common.Security;
using HR.Common.Util;
using HR.TaxService.Clients;
using HR.TaxService.Data;
using HR.TaxService.DTOs;
using HR.TaxService.Engine;
using HR.TaxService.Entities;
using Microsoft.EntityFrameworkCore;

namespace HR.TaxService.Services;

public interface IComputationService
{
    Task<List<TaxRuleDto>> ListRulesAsync(string? fy, CancellationToken ct);
    Task<List<TaxRuleDto>> UpsertRuleAsync(TaxRuleRequest r, CancellationToken ct);
    Task<TaxComputationDto> ComputeAsync(string employeeId, string fy, decimal? grossOverride, string? regimeOverride, bool persist, CancellationToken ct);
    Task<MonthlyTdsDto> MonthlyTdsAsync(string employeeId, string month, CancellationToken ct);
    Task<AnnualSummaryDto> AnnualSummaryAsync(string employeeId, string fy, CancellationToken ct);
    Task<byte[]> StatementPdfAsync(string employeeId, string fy, CancellationToken ct);
    Task<TaxDocumentDto> RegisterDocumentAsync(TaxDocumentRequest r, CancellationToken ct);
    Task<List<TaxDocumentDto>> ListDocumentsAsync(string employeeId, string? fy, CancellationToken ct);
}

public sealed class ComputationService(TaxDbContext db, IPayrollClient payroll, ICacheService cache, ICurrentUser user, IAuditWriter audit) : IComputationService
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
    private static TaxDocumentDto ToDto(TaxDocument d) => new(d.Id, d.EmployeeId, d.FinancialYear, d.DocType, d.DocumentId, d.FileName, d.CreatedAt);
    private static TaxRuleDto ToDto(TaxRule r) => new(r.Id, r.FinancialYear, r.Regime, r.StandardDeduction, r.RebateLimit, r.RebateAmount, r.CessPercent,
        JsonSerializer.Deserialize<List<SlabItem>>(r.Slabs, Json) ?? [], JsonSerializer.Deserialize<Dictionary<string, decimal>>(r.SectionLimits, Json) ?? [], r.Active);

    private void AssertAccess(string employeeId)
    {
        if (user.EmployeeId == employeeId || user.HasAnyPermission(Perm.TaxReview, Perm.TaxConfig) || user.IsSuperAdmin) return;
        throw new ForbiddenException("You may only view your own tax information");
    }

    // ------------------------------------------------------------------ configurable rules per financial year
    public async Task<List<TaxRuleDto>> ListRulesAsync(string? fy, CancellationToken ct) =>
        (await db.TaxRules.AsNoTracking().Where(r => fy == null || r.FinancialYear == fy).OrderByDescending(r => r.FinancialYear).ThenBy(r => r.Regime).ToListAsync(ct)).Select(ToDto).ToList();

    public async Task<List<TaxRuleDto>> UpsertRuleAsync(TaxRuleRequest r, CancellationToken ct)
    {
        var existing = await db.TaxRules.FirstOrDefaultAsync(x => x.FinancialYear == r.FinancialYear && x.Regime == r.Regime, ct);
        var created = existing is null;
        existing ??= db.TaxRules.Add(new TaxRule()).Entity;
        existing.FinancialYear = r.FinancialYear; existing.Regime = r.Regime; existing.StandardDeduction = r.StandardDeduction; existing.RebateLimit = r.RebateLimit; existing.RebateAmount = r.RebateAmount;
        existing.CessPercent = r.CessPercent; existing.Slabs = JsonSerializer.Serialize(r.Slabs, Json); existing.SectionLimits = JsonSerializer.Serialize(r.SectionLimits, Json); existing.Active = r.Active;
        await db.SaveChangesAsync(ct);
        await audit.WriteAsync("TaxRule", $"{r.FinancialYear}:{r.Regime}", created ? "CREATED" : "UPDATED", null, new { fy = r.FinancialYear });
        await cache.EvictPrefixAsync("tax:");
        return await ListRulesAsync(r.FinancialYear, ct);
    }

    private async Task<Rule> RuleAsync(string fy, string regime, CancellationToken ct)
    {
        var entity = await cache.GetOrCreateAsync($"tax:rule:{fy}:{regime}", async c => (await db.TaxRules.AsNoTracking().FirstOrDefaultAsync(r => r.FinancialYear == fy && r.Regime == regime && r.Active, c)) is { } e ? ToDto(e) : null, CacheKeys.Medium, ct);
        if (entity is null) throw new BusinessRuleException($"No active {regime} tax rules configured for {fy}");
        return new Rule(entity.Regime, entity.StandardDeduction, entity.RebateLimit, entity.RebateAmount, entity.CessPercent, entity.Slabs.Select(s => new Slab(s.From, s.To, s.Rate)).ToList(), entity.SectionLimits);
    }

    // ------------------------------------------------------------------ computation
    public async Task<TaxComputationDto> ComputeAsync(string employeeId, string fy, decimal? grossOverride, string? regimeOverride, bool persist, CancellationToken ct)
    {
        AssertAccess(employeeId);
        return await ComputeUncheckedAsync(employeeId, fy, grossOverride, regimeOverride, persist, ct);
    }

    private async Task<TaxComputationDto> ComputeUncheckedAsync(string employeeId, string fy, decimal? grossOverride, string? regimeOverride, bool persist, CancellationToken ct)
    {
        var declaration = await db.TaxDeclarations.AsNoTracking().FirstOrDefaultAsync(d => d.EmployeeId == employeeId && d.FinancialYear == fy, ct);
        var regime = regimeOverride ?? declaration?.Regime ?? "NEW";
        var gross = grossOverride ?? await payroll.AnnualGrossAsync(employeeId, ct);
        if (gross is null or 0) throw new Common.Common.ValidationException("Gross income is unknown: provide grossIncome or assign a salary in payroll");
        var rule = await RuleAsync(fy, regime, ct);
        var lines = new List<DeclarationLine>();
        if (declaration is not null && regime == "OLD")
        {
            var inv = await db.InvestmentDeclarations.AsNoTracking().Where(i => i.DeclarationId == declaration.Id && i.Status != "REJECTED").ToListAsync(ct);
            lines = inv.Select(i => new DeclarationLine(i.Section, declaration.Status == "APPROVED" ? i.ApprovedAmount : i.DeclaredAmount)).ToList();
        }
        var res = TaxCalculator.Compute(gross.Value, rule, lines);
        if (persist) await SaveAsync(employeeId, fy, regime, res, declaration?.Status == "APPROVED", ct);
        return new TaxComputationDto(employeeId, fy, regime, declaration?.Status, res.GrossIncome, res.StandardDeduction, res.TotalDeductions, res.TaxableIncome, res.SlabTax, res.Rebate, res.Cess, res.TotalTax, res.SectionDeductions);
    }

    private async Task SaveAsync(string employeeId, string fy, string regime, TaxResult r, bool approved, CancellationToken ct)
    {
        var row = await db.TaxComputations.FirstOrDefaultAsync(c => c.EmployeeId == employeeId && c.FinancialYear == fy, ct);
        if (row is null) { row = new TaxComputation { EmployeeId = employeeId, FinancialYear = fy }; db.TaxComputations.Add(row); }
        row.Regime = regime; row.GrossIncome = r.GrossIncome; row.StandardDeduction = r.StandardDeduction; row.TotalDeductions = r.TotalDeductions; row.TaxableIncome = r.TaxableIncome; row.SlabTax = r.SlabTax;
        row.Rebate = r.Rebate; row.Cess = r.Cess; row.TotalTax = r.TotalTax; row.DeclarationApproved = approved; row.ComputedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
    }

    /// <summary>Monthly TDS = (annual tax - TDS already deducted in the FY) / remaining months. Called by Payroll.</summary>
    public async Task<MonthlyTdsDto> MonthlyTdsAsync(string employeeId, string month, CancellationToken ct)
    {
        if (!(user.HasAnyPermission(Perm.TaxReview, Perm.PayrollProcess) || user.IsSuperAdmin)) throw new ForbiddenException();
        var y = int.Parse(month[..4]); var m = int.Parse(month[5..]);
        var fy = TaxCalculator.FinancialYear(y, m);
        var remaining = m >= 4 ? 12 - (m - 4) : 4 - m;
        TaxComputationDto comp;
        try { comp = await ComputeUncheckedAsync(employeeId, fy, null, null, true, ct); }
        catch (HrException ex) when (ex.Status is System.Net.HttpStatusCode.UnprocessableEntity or System.Net.HttpStatusCode.BadRequest) { throw new NotFoundException("Tax computation not available"); }
        var paid = await db.MonthlyTds.AsNoTracking().Where(t => t.EmployeeId == employeeId && t.FinancialYear == fy && string.Compare(t.TdsMonth, month) < 0).SumAsync(t => (decimal?)t.Tds, ct) ?? 0;
        var tds = Math.Round(Math.Max(0, (comp.TotalTax - paid) / Math.Max(1, remaining)), 2);
        var row = await db.MonthlyTds.FirstOrDefaultAsync(t => t.EmployeeId == employeeId && t.TdsMonth == month, ct);
        if (row is null) { row = new MonthlyTd { EmployeeId = employeeId, TdsMonth = month, FinancialYear = fy }; db.MonthlyTds.Add(row); }
        row.Regime = comp.Regime; row.Tds = tds; row.DeclarationApproved = comp.DeclarationStatus == "APPROVED"; row.ComputedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
        return new MonthlyTdsDto(employeeId, month, fy, comp.Regime, comp.TotalTax, paid, remaining, tds);
    }

    public async Task<AnnualSummaryDto> AnnualSummaryAsync(string employeeId, string fy, CancellationToken ct)
    {
        AssertAccess(employeeId);
        TaxComputationDto? comp = null;
        try { comp = await ComputeUncheckedAsync(employeeId, fy, null, null, false, ct); } catch (HrException) { }
        var monthly = await db.MonthlyTds.AsNoTracking().Where(t => t.EmployeeId == employeeId && t.FinancialYear == fy).OrderBy(t => t.TdsMonth).Select(t => new TdsMonthItem(t.TdsMonth, t.Tds, t.Regime)).ToListAsync(ct);
        var decl = await db.TaxDeclarations.AsNoTracking().FirstOrDefaultAsync(d => d.EmployeeId == employeeId && d.FinancialYear == fy, ct);
        var docs = await db.TaxDocuments.AsNoTracking().Where(d => d.EmployeeId == employeeId && d.FinancialYear == fy).ToListAsync(ct);
        var deducted = monthly.Sum(m => m.Tds);
        return new AnnualSummaryDto(employeeId, fy, comp, monthly, deducted, comp is null ? null : Math.Round(comp.TotalTax - deducted, 2),
            decl is null ? null : new DeclarationSummaryDto(decl.Id, decl.EmployeeId, decl.EmployeeName, decl.FinancialYear, decl.Regime, decl.Status, decl.TotalDeclared, decl.TotalApproved, decl.SubmittedAt, decl.ReviewComment, decl.Version),
            docs.Select(ToDto).ToList());
    }

    /// <summary>Income-tax computation statement as a PDF (CPU-bound rendering offloaded to the thread pool).</summary>
    public async Task<byte[]> StatementPdfAsync(string employeeId, string fy, CancellationToken ct)
    {
        var s = await AnnualSummaryAsync(employeeId, fy, ct);
        var c = s.Computation ?? throw new BusinessRuleException("No computation available for this employee/year");
        string F(decimal n) => n.ToString("N2", CultureInfo.InvariantCulture);
        return await Task.Run(() =>
        {
            var pdf = new SimplePdf().Title("Income Tax Computation Statement").Text($"Financial year {fy} - {c.Regime} regime").Gap(6).Heading("Computation")
                .Row("Gross income", F(c.GrossIncome)).Row("Standard deduction", F(c.StandardDeduction)).Row("Chapter VI-A deductions", F(c.TotalDeductions)).Row("Taxable income", F(c.TaxableIncome))
                .Row("Tax on slabs", F(c.SlabTax)).Row("Rebate", F(c.Rebate)).Row("Cess", F(c.Cess)).Row("Total tax", F(c.TotalTax), bold: true).Heading("TDS deducted");
            foreach (var m in s.MonthlyTds) pdf.Row(m.TdsMonth, F(m.Tds));
            return pdf.Row("Total TDS deducted", F(s.TotalTdsDeducted), bold: true).Gap(16).Text("Computed from configured tax rules; verify before filing.").ToBytes();
        }, ct);
    }

    // ------------------------------------------------------------------ Form 16 / tax documents (file bytes live in the Document Service)
    public async Task<TaxDocumentDto> RegisterDocumentAsync(TaxDocumentRequest r, CancellationToken ct)
    {
        var d = new TaxDocument { EmployeeId = r.EmployeeId, FinancialYear = r.FinancialYear, DocType = r.DocType, DocumentId = r.DocumentId, FileName = r.FileName };
        db.TaxDocuments.Add(d);
        await db.SaveChangesAsync(ct);
        return ToDto(d);
    }

    public async Task<List<TaxDocumentDto>> ListDocumentsAsync(string employeeId, string? fy, CancellationToken ct)
    {
        AssertAccess(employeeId);
        return (await db.TaxDocuments.AsNoTracking().Where(d => d.EmployeeId == employeeId && (fy == null || d.FinancialYear == fy)).OrderByDescending(d => d.CreatedAt).ToListAsync(ct)).Select(ToDto).ToList();
    }
}
