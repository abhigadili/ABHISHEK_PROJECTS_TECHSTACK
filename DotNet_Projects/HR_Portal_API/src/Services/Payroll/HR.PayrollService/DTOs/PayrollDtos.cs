using System.ComponentModel.DataAnnotations;
using HR.Common.Common;

namespace HR.PayrollService.DTOs;

public static class Rx { public const string Month = @"^\d{4}-(0[1-9]|1[0-2])$"; }

public sealed record StructureComponentItem([Required, StringLength(36, MinimumLength = 36)] string ComponentId, [Range(0, 100_000_000)] decimal Value);

/// <summary>Custom validation: a structure needs components; percentage-based values may not exceed 100 (checked against the component types in the service).</summary>
public sealed class StructureRequest
{
    [Required, StringLength(120)] public string Name { get; set; } = "";
    [StringLength(255)] public string? Description { get; set; }
    public bool Active { get; set; } = true;
    [Required, MinLength(1)] public List<StructureComponentItem> Components { get; set; } = [];
}
public sealed class StructureUpdateRequest { [StringLength(120)] public string? Name { get; set; } [StringLength(255)] public string? Description { get; set; } public bool? Active { get; set; } public List<StructureComponentItem>? Components { get; set; } }
public sealed record StructureComponentDto(string ComponentId, string Code, string Name, string Type, string CalcType, decimal Value, int DisplayOrder);
public sealed record StructureDto(string Id, string Name, string? Description, bool Active, List<StructureComponentDto> Components);

public sealed record ConfigItem([Required, RegularExpression("^[a-z0-9_.]+$"), StringLength(100)] string Key, [Required, StringLength(2000)] string Value, [StringLength(255)] string? Description);
public sealed record UpdateConfigRequest([Required, MinLength(1)] List<ConfigItem> Items);
public sealed record ConfigDto(string Key, string Value, string? Description, DateTime EffectiveFrom);

public sealed record AssignSalaryRequest([Required, StringLength(36, MinimumLength = 36)] string EmployeeId, [Required, StringLength(36, MinimumLength = 36)] string StructureId,
    [Range(1, 1_000_000_000)] decimal AnnualCtc, [Required] DateOnly? EffectiveFrom, [StringLength(3, MinimumLength = 3)] string Currency = "INR");
public sealed record SalaryDto(string Id, string EmployeeId, string StructureId, decimal AnnualCtc, string Currency, DateOnly EffectiveFrom, DateOnly? EffectiveTo, string Status, long Version);
public sealed record SalarySummaryDto(string EmployeeId, string StructureName, decimal AnnualCtc, decimal? MonthlyCtc, decimal? MonthlyBasic, string Currency, DateOnly EffectiveFrom);
public sealed record RevisionHistoryDto(long Id, string SalaryId, string Action, decimal? OldCtc, decimal? NewCtc, string? OldStatus, string? NewStatus, DateOnly? EffectiveFrom, DateTime ChangedAt, string? ChangedBy);
public sealed record EmployeeSalaryDto(SalarySummaryDto? Summary, List<SalaryDto> History, List<RevisionHistoryDto> RevisionHistory);

public sealed record RevisionRequest([Required, StringLength(36, MinimumLength = 36)] string EmployeeId, [Range(1, 1_000_000_000)] decimal NewCtc, [StringLength(36, MinimumLength = 36)] string? NewStructureId,
    [Required] DateOnly? EffectiveFrom, [Required, StringLength(255, MinimumLength = 5)] string Reason);
public sealed record RevisionDto(string Id, string EmployeeId, decimal OldCtc, decimal NewCtc, string? NewStructureId, DateOnly EffectiveFrom, string Reason, string Status, string? DecisionComment, DateTime? DecidedAt, DateTime CreatedAt);
public sealed record DecisionRequest([StringLength(255)] string? Comment);
public sealed record RejectRequest([Required, StringLength(255, MinimumLength = 3)] string Comment);

public sealed class AdjustmentRequest
{
    [Required, StringLength(36, MinimumLength = 36)] public string EmployeeId { get; set; } = "";
    [Required, RegularExpression("^(BONUS|ALLOWANCE|ARREARS|REIMBURSEMENT|OTHER_DEDUCTION|FINAL_SETTLEMENT)$")] public string Type { get; set; } = "";
    [Range(0.01, 100_000_000)] public decimal Amount { get; set; }
    [Required, RegularExpression(Rx.Month)] public string PayrollMonth { get; set; } = "";
    [StringLength(255)] public string? Description { get; set; }
    [StringLength(36, MinimumLength = 36)] public string? ReferenceId { get; set; }
}
public sealed record AdjustmentDto(string Id, string EmployeeId, string Type, decimal Amount, string PayrollMonth, string? Description, string? ReferenceId, string Status, string? AppliedRunId, DateTime CreatedAt);
public sealed record LoanRequest([Required, StringLength(36, MinimumLength = 36)] string EmployeeId, [Range(1, 100_000_000)] decimal Principal, [Range(1, 100_000_000)] decimal Emi,
    [Required, RegularExpression(Rx.Month)] string StartMonth, [Required, StringLength(255)] string Description) : IValidatableObject
{
    public IEnumerable<ValidationResult> Validate(ValidationContext c) { if (Emi > Principal) yield return new("emi cannot exceed principal", [nameof(Emi)]); }
}
public sealed record LoanDto(string Id, string EmployeeId, decimal Principal, decimal Outstanding, decimal Emi, string StartMonth, string Description, string Status, long Version);
public sealed record SettlementPostRequest([Required, StringLength(36, MinimumLength = 36)] string EmployeeId, decimal Amount, [Required, RegularExpression(Rx.Month)] string Month,
    [Required, StringLength(36, MinimumLength = 36)] string ReferenceId, [StringLength(255)] string? Description) : IValidatableObject
{
    public IEnumerable<ValidationResult> Validate(ValidationContext c) { if (Amount == 0) yield return new("amount must be non-zero", [nameof(Amount)]); }
}
public sealed record SettlementBasisDto(decimal MonthlyGross, string Currency);

public sealed record CreateRunRequest([Required, RegularExpression(Rx.Month)] string Month, [StringLength(255)] string? Note);
public sealed class RunListQuery : PageQuery { [RegularExpression("^(DRAFT|PROCESSED|APPROVED|FINALIZED)$")] public string? Status { get; set; } }
public sealed class EntryListQuery : PageQuery { public string? DepartmentId { get; set; } public string? EmployeeId { get; set; } }
public sealed class YearQuery { [Range(2000, 2100)] public int? Year { get; set; } }

public sealed record RunDto(string Id, string PayrollMonth, string Status, string? Note, int EmployeeCount, decimal TotalGross, decimal TotalDeductions, decimal TotalNet, string? ProcessedBy, DateTime? ProcessedAt,
    string? ApprovedBy, DateTime? ApprovedAt, string? FinalizedBy, DateTime? FinalizedAt, long Version);
public sealed record DepartmentTotalDto(string? DepartmentId, int Employees, decimal Gross, decimal Deductions, decimal Net);
public sealed record RunDetailDto(RunDto Run, List<DepartmentTotalDto> ByDepartment);
public sealed record EntryDto(string Id, string RunId, string PayrollMonth, string EmployeeId, string? EmployeeCode, string? EmployeeName, string? DepartmentId, decimal WorkingDays, decimal PaidDays,
    decimal LopDays, int OvertimeMinutes, decimal Gross, decimal Deductions, decimal Net);
public sealed record EntryLineDto(string ComponentCode, string ComponentName, string Type, decimal Amount, string? Note);
public sealed record EntryDetailDto(EntryDto Entry, List<EntryLineDto> Lines);
public sealed record SkippedDto(string EmployeeId, string Reason);
public sealed record CalculationResultDto(string RunId, int Calculated, List<SkippedDto> Skipped);
public sealed record ComponentTotalDto(string ComponentCode, string Type, decimal Amount);
public sealed record RunReportDto(RunDto Run, List<DepartmentTotalDto> ByDepartment, List<ComponentTotalDto> ByComponent);
public sealed record EmployeePayrollHistoryDto(string PayrollMonth, decimal Gross, decimal Deductions, decimal Net, decimal PaidDays, decimal LopDays, string RunId);
public sealed record PayslipDto(string Id, string EmployeeId, string PayrollMonth, string FileName, long SizeBytes, DateTime GeneratedAt);

// clients
public sealed record DirectoryEntry(string EmployeeId, string EmployeeCode, string FullName, string DepartmentId, string Status, DateOnly JoiningDate);
public sealed record AttendanceInput(string EmployeeId, string Month, int WorkingDays, int PresentDays, int HalfDays, int AbsentDays, int LeaveDays, int Holidays, int OvertimeMinutes);
public sealed record LeaveMonthly(decimal PaidLeaveDays, decimal UnpaidLeaveDays);
public sealed record TdsResult(decimal Tds);
