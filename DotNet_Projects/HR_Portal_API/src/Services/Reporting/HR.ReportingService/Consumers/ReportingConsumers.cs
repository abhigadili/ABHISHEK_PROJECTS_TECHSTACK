using HR.Common.Messaging;
using HR.ReportingService.Data;
using HR.ReportingService.Entities;
using HR.ReportingService.Services;
using Microsoft.EntityFrameworkCore;

namespace HR.ReportingService.Consumers;

/// <summary>Kafka-maintained reporting data: rpt_employees (read model) and rpt_facts (one row per business fact, idempotent upserts).</summary>
public sealed class ReportingEmployeeReadModel(ReportingDbContext db) : IEmployeeReadModel
{
    public async Task UpsertAsync(EmployeeEvent e, CancellationToken ct)
    {
        var row = await db.RptEmployees.FirstOrDefaultAsync(x => x.EmployeeId == e.EmployeeId, ct);
        if (row is null) { row = new RptEmployee { EmployeeId = e.EmployeeId }; db.RptEmployees.Add(row); }
        row.DepartmentId = e.DepartmentId; row.DesignationId = e.DesignationId; row.EmployeeCode = e.EmployeeCode; row.ExitDate = e.ExitDate; row.FullName = e.FullName; row.JoiningDate = e.JoiningDate;
        row.LocationId = e.LocationId; row.ManagerId = e.ManagerId; row.Status = e.Status; row.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
    }
}

public sealed class FactHandler<TEvent>(string topic, IReportingService reports, Func<TEvent, FactSpec> map) : EventHandlerBase<TEvent> where TEvent : IntegrationEvent
{
    public override string Topic => topic;
    public override string Name => "ReportingFact";
    protected override Task HandleAsync(TEvent e, CancellationToken ct)
    {
        var f = map(e);
        return reports.RecordFactAsync(f.Type, f.SubjectKey, f.Category, f.Status, f.Period, f.DateA, f.DateB, f.EmployeeId, f.A, f.B, f.C, e.OccurredAt.UtcDateTime, ct);
    }
}

public sealed record FactSpec(string Type, string SubjectKey, string? Category = null, string? Status = null, string? Period = null, DateOnly? DateA = null, DateOnly? DateB = null, string? EmployeeId = null, decimal? A = null, decimal? B = null, decimal? C = null);

public static class ReportingConsumerRegistration
{
    private static string M(DateOnly d) => d.ToString("yyyy-MM");

    public static IServiceCollection AddReportingConsumers(this IServiceCollection s)
    {
        void Add<T>(string topic, Func<T, FactSpec> map) where T : IntegrationEvent => s.AddScoped<IEventHandler>(sp => new FactHandler<T>(topic, sp.GetRequiredService<IReportingService>(), map));
        void Leave(string topic, string status) => Add<LeaveEvent>(topic, e => new("LEAVE", e.LeaveId, e.LeaveType, status, M(e.FromDate), e.FromDate, e.ToDate, e.EmployeeId, e.Days));
        Leave(Topics.LeaveApplied, "APPLIED"); Leave(Topics.LeaveApproved, "APPROVED"); Leave(Topics.LeaveRejected, "REJECTED"); Leave(Topics.LeaveCancelled, "CANCELLED");
        void Att(string topic, string status) => Add<AttendanceEvent>(topic, e => new("ATTENDANCE", $"{e.EmployeeId}:{e.WorkDate:yyyy-MM-dd}:{status}", null, status, M(e.WorkDate), e.WorkDate, null, e.EmployeeId, e.WorkedMinutes, e.OvertimeMinutes, e.LateMinutes));
        Att(Topics.AttendanceCheckedIn, "CHECKED_IN"); Att(Topics.AttendanceCheckedOut, "CHECKED_OUT"); Att(Topics.AttendanceCorrected, "CORRECTED");
        Add<TimesheetEvent>(Topics.TimesheetSubmitted, e => new("TIMESHEET", e.TimesheetId, null, "SUBMITTED", M(e.WeekStart), e.WeekStart, null, e.EmployeeId, e.TotalHours));
        Add<TimesheetEvent>(Topics.TimesheetApproved, e => new("TIMESHEET", e.TimesheetId, null, "APPROVED", M(e.WeekStart), e.WeekStart, null, e.EmployeeId, e.TotalHours));
        Add<TaxDeclarationEvent>(Topics.TaxDeclarationSubmitted, e => new("TAX", e.DeclarationId, e.Regime, "SUBMITTED", e.FinancialYear, null, null, e.EmployeeId, e.TotalDeclared));
        Add<PerformanceReviewEvent>(Topics.PerformanceReviewSubmitted, e => new("REVIEW", $"{e.ReviewId}:{e.Status}", e.Status, "SUBMITTED", null, null, null, e.EmployeeId, e.Rating));
        Add<ResignationEvent>(Topics.ResignationSubmitted, e => new("EXIT", e.ResignationId, null, "SUBMITTED", M(e.LastWorkingDay), e.LastWorkingDay, null, e.EmployeeId));
        Add<PayrollProcessedEvent>(Topics.PayrollProcessed, e => new("PAYROLL", e.RunId, null, "FINALIZED", $"{e.Year}-{e.Month:D2}", null, null, null, e.TotalNet, e.EmployeeCount));
        Add<EmployeeExitedEvent>(Topics.EmployeeExited, e => new("EXIT", e.ResignationId, null, "EXITED", M(e.LastWorkingDay), e.LastWorkingDay, null, e.EmployeeId));
        return s;
    }
}
