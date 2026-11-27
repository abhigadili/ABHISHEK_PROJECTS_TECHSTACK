using System.ComponentModel.DataAnnotations;
using HR.Common.Common;

namespace HR.ReportingService.DTOs;

public sealed class PeriodQuery : IValidatableObject
{
    public DateOnly? From { get; set; }
    public DateOnly? To { get; set; }
    public string? DepartmentId { get; set; }
    public IEnumerable<ValidationResult> Validate(ValidationContext c) { if (To < From) yield return new("to must not precede from", [nameof(To)]); }
}
public sealed class MonthQuery { [RegularExpression(@"^\d{4}-(0[1-9]|1[0-2])$")] public string? Month { get; set; } }
public sealed class FyQuery { [RegularExpression(@"^\d{4}-\d{2}$")] public string? Fy { get; set; } }
public sealed class ProjectReportQuery { [RegularExpression("^(PLANNED|ACTIVE|ON_HOLD|COMPLETED|CANCELLED)$")] public string? Status { get; set; } }
public sealed class CycleQuery { public string? CycleId { get; set; } }

public sealed record DepartmentHeadcountDto(string? DepartmentId, string Status, long Employees);
public sealed record MovementDto(string EmployeeId, string? FullName, string? DepartmentId, DateOnly Date);
public sealed record HeadcountReportDto(DateOnly From, DateOnly To, string Scope, int? TeamSize, long ActiveHeadcount, List<DepartmentHeadcountDto> ByDepartment, List<MovementDto> Joiners, List<MovementDto> Leavers);
public sealed record GroupTotalDto(string Key, string Status, int Applications, decimal Days);
public sealed record UtilizationDto(string? Month, string? LeaveType, string? Status, long Applications, decimal? Days);
public sealed record LeaveReportDto(DateOnly From, DateOnly To, int Applications, List<GroupTotalDto> ByType, List<GroupTotalDto> ByDepartment, List<UtilizationDto> UtilizationByMonth);
public sealed record DailyAttendanceDto(DateOnly Date, int CheckIns, int CheckOuts, int Corrections, decimal? AvgWorkedMinutes);
public sealed record AttendanceReportDto(string Month, DateOnly From, DateOnly To, List<DailyAttendanceDto> Daily);
public sealed record TaxStatusDto(string? Status, string? Regime, int Declarations, decimal TotalDeclared);
public sealed record TaxReportDto(string FinancialYear, List<TaxStatusDto> Declarations);
public sealed record TimesheetStatusDto(string? Status, int Timesheets, decimal TotalHours);
public sealed record TimesheetReportDto(DateOnly From, DateOnly To, List<TimesheetStatusDto> ByStatus);
public sealed record ExitReasonDto(string Reason, int Exits);
public sealed record ExitFactDto(string SubjectKey, string? Status, string? EmployeeId, string? Period, DateOnly? Date);
public sealed record ExitReportDto(DateOnly From, DateOnly To, List<ExitFactDto> Exits, List<ExitReasonDto> ByReason, List<MovementDto> LeaversByMonth);
public sealed record PerformanceSubmissionDto(string? Category, int Submissions);
public sealed record PerformanceReportDto(List<PerformanceSubmissionDto> Submissions, object? Cycle);
public sealed record AllocationLoadDto(string EmployeeId, string? Name, decimal TotalAllocation, List<string> Projects);
public sealed record ProjectReportDto(List<object> Projects, List<AllocationLoadDto> EmployeeLoad, List<AllocationLoadDto> OverAllocated);
public sealed record SummaryDto(HeadcountReportDto? Headcount, LeaveReportDto? Leave, AttendanceReportDto? Attendance, TimesheetReportDto? Timesheets, ExitReportDto? Exits, List<string> Unavailable);

// downstream payloads
public sealed record RunLite(string Id, string PayrollMonth, string Status, int EmployeeCount, decimal TotalGross, decimal TotalDeductions, decimal TotalNet);
public sealed record RunPage(List<RunLite> Items);
public sealed record AllocationLite(string EmployeeId, string? EmployeeName, string Role, decimal AllocationPercent, bool Billable, string Status);
public sealed record ProjectLite(string Id, string Code, string Name, string Status);
public sealed record ProjectPage(List<ProjectLite> Items);
public sealed record ProjectDetailLite(ProjectLite Project, List<AllocationLite> Team);
