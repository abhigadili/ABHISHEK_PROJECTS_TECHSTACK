namespace HR.Common.Messaging;

/// <summary>Event envelope fields shared by every integration event: unique id (idempotency), schema version, occurrence time, correlation id.</summary>
public abstract record IntegrationEvent
{
    public string EventId { get; init; } = Guid.NewGuid().ToString();
    public int SchemaVersion { get; init; } = 1;
    public DateTimeOffset OccurredAt { get; init; } = DateTimeOffset.UtcNow;
    public string? CorrelationId { get; init; } = Common.CorrelationContext.Id;
}

public static class Topics
{
    public const string EmployeeCreated = "employee.created", EmployeeUpdated = "employee.updated", EmployeeTerminated = "employee.terminated",
        LeaveApplied = "leave.applied", LeaveApproved = "leave.approved", LeaveRejected = "leave.rejected", LeaveCancelled = "leave.cancelled",
        AttendanceCheckedIn = "attendance.checked-in", AttendanceCheckedOut = "attendance.checked-out", AttendanceCorrected = "attendance.corrected",
        PayrollProcessed = "payroll.processed", PayslipGenerated = "payslip.generated", TaxDeclarationSubmitted = "tax.declaration.submitted",
        PerformanceReviewSubmitted = "performance.review.submitted", TimesheetSubmitted = "timesheet.submitted", TimesheetApproved = "timesheet.approved",
        ResignationSubmitted = "resignation.submitted", ResignationWithdrawn = "resignation.withdrawn", EmployeeExited = "employee.exited", NotificationRequested = "notification.requested";

    public static readonly string[] All =
    [
        EmployeeCreated, EmployeeUpdated, EmployeeTerminated, LeaveApplied, LeaveApproved, LeaveRejected, LeaveCancelled,
        AttendanceCheckedIn, AttendanceCheckedOut, AttendanceCorrected, PayrollProcessed, PayslipGenerated, TaxDeclarationSubmitted,
        PerformanceReviewSubmitted, TimesheetSubmitted, TimesheetApproved, ResignationSubmitted, ResignationWithdrawn, EmployeeExited, NotificationRequested
    ];

    public static string Dlt(string topic) => topic + ".DLT";
}

/// <summary>Full employee snapshot published on employee.created / updated / terminated. Every service keeps its own read model from it.</summary>
public sealed record EmployeeEvent(string EmployeeId, string EmployeeCode, string FullName, string? WorkEmail, string? DepartmentId, string? DesignationId,
    string? LocationId, string? ManagerId, string Status, DateOnly? JoiningDate, DateOnly? ExitDate, string? Gender, string ChangeType) : IntegrationEvent;

public sealed record LeaveEvent(string LeaveId, string EmployeeId, string EmployeeName, string? ManagerId, string LeaveType, DateOnly FromDate, DateOnly ToDate,
    decimal Days, string Status, string? Reason, string? ActorId, string? Comment) : IntegrationEvent;

public sealed record AttendanceEvent(string EmployeeId, DateOnly WorkDate, DateTime? CheckIn, DateTime? CheckOut, string Status, int WorkedMinutes, int LateMinutes,
    int EarlyMinutes, int OvertimeMinutes, string? CorrectionId) : IntegrationEvent;

public sealed record PayrollProcessedEvent(string RunId, int Year, int Month, int EmployeeCount, decimal TotalGross, decimal TotalNet, string Status, string? ActorId) : IntegrationEvent;

public sealed record PayslipGeneratedEvent(string PayslipId, string EmployeeId, string EmployeeName, string? WorkEmail, int Year, int Month, decimal NetPay, string FilePath, string FileName, long SizeBytes) : IntegrationEvent;

public sealed record TaxDeclarationEvent(string DeclarationId, string EmployeeId, string FinancialYear, string Regime, decimal TotalDeclared, string Status) : IntegrationEvent;

public sealed record PerformanceReviewEvent(string ReviewId, string EmployeeId, string? ManagerId, string CycleId, string Status, decimal? Rating) : IntegrationEvent;

public sealed record TimesheetEvent(string TimesheetId, string EmployeeId, string? ManagerId, DateOnly WeekStart, decimal TotalHours, decimal BillableHours, string Status, string? Comment) : IntegrationEvent;

public sealed record ResignationEvent(string ResignationId, string EmployeeId, string EmployeeName, string? ManagerId, DateOnly LastWorkingDay, string Status) : IntegrationEvent;

public sealed record EmployeeExitedEvent(string EmployeeId, string ResignationId, DateOnly LastWorkingDay, string FinalStatus) : IntegrationEvent;

/// <summary>Raised by any service to ask the Notification Service to deliver a message (email and/or in-app).</summary>
public sealed record NotificationRequestedEvent(string? RecipientEmployeeId, string? RecipientEmail, string TemplateCode, string Channel, string? Subject, string? Message,
    Dictionary<string, string>? Variables, string? ReferenceType, string? ReferenceId, string? DedupKey) : IntegrationEvent;
