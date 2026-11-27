using System.ComponentModel.DataAnnotations;
using HR.Common.Common;

namespace HR.TaxService.DTOs;

/// <summary>Custom validation attribute: a financial year like 2026-27 whose second part follows the first.</summary>
[AttributeUsage(AttributeTargets.Property | AttributeTargets.Parameter)]
public sealed class FinancialYearAttribute : ValidationAttribute
{
    public override bool IsValid(object? value) =>
        value is null || (value is string s && s.Length == 7 && s[4] == '-' && int.TryParse(s[..4], out var a) && int.TryParse(s[5..], out var b) && b == (a + 1) % 100);
    public override string FormatErrorMessage(string name) => "Expected a financial year like 2026-27";
}

public sealed record CreateDeclarationRequest([Required, FinancialYear] string FinancialYear, [RegularExpression("^(OLD|NEW)$")] string Regime = "NEW");
public sealed record RegimeRequest([Required, RegularExpression("^(OLD|NEW)$")] string Regime);
public sealed record InvestmentRequest([Required, StringLength(30, MinimumLength = 2), RegularExpression("^[A-Za-z0-9_]+$")] string Section, [Required, StringLength(255, MinimumLength = 2)] string Description, [Range(0.01, 100_000_000)] decimal DeclaredAmount);
public sealed record ProofRequest([Required, StringLength(36, MinimumLength = 36)] string InvestmentId, [Required, StringLength(36, MinimumLength = 36)] string DocumentId, [StringLength(190)] string? FileName);
public sealed record DecisionRequest([StringLength(500)] string? Comment);
public sealed record RejectRequest([Required, StringLength(500, MinimumLength = 3)] string Comment);
public sealed record VerifyProofRequest([Range(0, 100_000_000)] decimal? ApprovedAmount, [StringLength(500)] string? Comment);

public sealed class DeclarationListQuery : PageQuery
{
    [FinancialYear] public string? FinancialYear { get; set; }
    [RegularExpression("^(DRAFT|SUBMITTED|UNDER_REVIEW|APPROVED|REJECTED)$")] public string? Status { get; set; }
    public string? EmployeeId { get; set; }
}
public sealed class ComputeQuery { [Required, FinancialYear] public string FinancialYear { get; set; } = ""; [Range(1, 10_000_000_000)] public decimal? GrossIncome { get; set; } [RegularExpression("^(OLD|NEW)$")] public string? Regime { get; set; } }

public sealed record SlabItem([Range(0, double.MaxValue)] decimal From, decimal? To, [Range(0, 100)] decimal Rate);
public sealed class TaxRuleRequest : IValidatableObject
{
    [Required, FinancialYear] public string FinancialYear { get; set; } = "";
    [Required, RegularExpression("^(OLD|NEW)$")] public string Regime { get; set; } = "";
    [Range(0, double.MaxValue)] public decimal StandardDeduction { get; set; }
    [Range(0, double.MaxValue)] public decimal RebateLimit { get; set; }
    [Range(0, double.MaxValue)] public decimal RebateAmount { get; set; }
    [Range(0, 30)] public decimal CessPercent { get; set; }
    [Required, MinLength(1)] public List<SlabItem> Slabs { get; set; } = [];
    public Dictionary<string, decimal> SectionLimits { get; set; } = [];
    public bool Active { get; set; } = true;
    public IEnumerable<ValidationResult> Validate(ValidationContext c)
    {
        for (var i = 0; i < Slabs.Count; i++)
            if (i == 0 ? Slabs[i].From != 0 : Slabs[i].From != Slabs[i - 1].To) { yield return new("Slabs must be contiguous and start at 0", [nameof(Slabs)]); yield break; }
        if (Slabs[^1].To is not null) yield return new("The last slab must be open-ended (to = null)", [nameof(Slabs)]);
    }
}
public sealed record TaxRuleDto(string Id, string FinancialYear, string Regime, decimal StandardDeduction, decimal RebateLimit, decimal RebateAmount, decimal CessPercent, List<SlabItem> Slabs, Dictionary<string, decimal> SectionLimits, bool Active);

public sealed record TaxDocumentRequest([Required, StringLength(36, MinimumLength = 36)] string EmployeeId, [Required, FinancialYear] string FinancialYear,
    [Required, RegularExpression("^(FORM16_PART_A|FORM16_PART_B|TAX_STATEMENT|OTHER)$")] string DocType, [Required, StringLength(36, MinimumLength = 36)] string DocumentId, [StringLength(190)] string? FileName);
public sealed record TaxDocumentDto(string Id, string EmployeeId, string FinancialYear, string DocType, string DocumentId, string? FileName, DateTime CreatedAt);

public sealed record InvestmentDto(string Id, string Section, string Description, decimal DeclaredAmount, decimal ApprovedAmount, string Status);
public sealed record ProofDto(string Id, string InvestmentId, string DocumentId, string? FileName, int AttemptNumber, string Status, string? ReviewerComment, DateTime? ReviewedAt);
public sealed record DeclarationHistoryDto(string Id, string Action, string? Comment, string? Status, decimal? TotalDeclared, DateTime CreatedAt);
public sealed record DeclarationSummaryDto(string Id, string EmployeeId, string? EmployeeName, string FinancialYear, string Regime, string Status, decimal TotalDeclared, decimal TotalApproved, DateTime? SubmittedAt, string? ReviewComment, long Version);
public sealed record DeclarationDto(DeclarationSummaryDto Declaration, List<InvestmentDto> Investments, List<ProofDto> Proofs, List<DeclarationHistoryDto> History);

public sealed record TaxComputationDto(string EmployeeId, string FinancialYear, string Regime, string? DeclarationStatus, decimal GrossIncome, decimal StandardDeduction, decimal TotalDeductions, decimal TaxableIncome,
    decimal SlabTax, decimal Rebate, decimal Cess, decimal TotalTax, Dictionary<string, decimal> SectionDeductions);
public sealed record MonthlyTdsDto(string EmployeeId, string Month, string FinancialYear, string Regime, decimal AnnualTax, decimal AlreadyDeducted, int RemainingMonths, decimal Tds);
public sealed record TdsMonthItem(string TdsMonth, decimal Tds, string Regime);
public sealed record AnnualSummaryDto(string EmployeeId, string FinancialYear, TaxComputationDto? Computation, List<TdsMonthItem> MonthlyTds, decimal TotalTdsDeducted, decimal? BalanceTax, DeclarationSummaryDto? Declaration, List<TaxDocumentDto> Documents);
public sealed record ReminderResultDto(int Reminded);

public sealed record PayrollSalarySummary(decimal? AnnualCtc);
public sealed record PayrollEmployeeSalary(PayrollSalarySummary? Summary);
public sealed record TdsMonthParams(string EmployeeId, string Month);
