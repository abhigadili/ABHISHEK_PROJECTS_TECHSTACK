using HR.Common.Messaging;
using HR.NotificationService.Data;
using HR.NotificationService.DTOs;
using HR.NotificationService.Entities;
using HR.NotificationService.Services;
using Microsoft.EntityFrameworkCore;

namespace HR.NotificationService.Consumers;

/// <summary>
/// Every business event on every topic is recorded in event_history (the data behind the history API); mapped events also create
/// notifications. One handler instance per topic (Observer pattern: services publish, this service reacts independently).
/// </summary>
public sealed class TopicHandler<TEvent>(string topic, INotificationService notifications, Func<TEvent, IEnumerable<NotifyRequest>> rule, Func<TEvent, string?> employeeOf) : EventHandlerBase<TEvent> where TEvent : IntegrationEvent
{
    public override string Topic => topic;
    public override string Name => "NotificationFanout";
    protected override async Task HandleAsync(TEvent e, CancellationToken ct)
    {
        await notifications.RecordEventAsync(e, employeeOf(e), ct);
        foreach (var n in rule(e)) { n.CorrelationId = e.CorrelationId; n.DedupKey ??= $"{e.EventId}:{n.Type}:{n.RecipientEmployeeId}"; await notifications.NotifyAsync(n, ct); }
    }
}

/// <summary>notification.requested: delivered exactly as asked by the requesting service (template or inline text, dedup key honoured).</summary>
public sealed class NotificationRequestedHandler(INotificationService notifications) : EventHandlerBase<NotificationRequestedEvent>
{
    public override string Topic => Topics.NotificationRequested;
    public override string Name => "NotificationRequested";
    protected override async Task HandleAsync(NotificationRequestedEvent e, CancellationToken ct)
    {
        await notifications.RecordEventAsync(e, e.RecipientEmployeeId, ct);
        await notifications.NotifyAsync(new NotifyRequest
        {
            Type = e.TemplateCode, RecipientEmployeeId = e.RecipientEmployeeId, RecipientEmail = e.RecipientEmail, Subject = e.Subject, Body = e.Message, TemplateCode = e.TemplateCode, Variables = e.Variables,
            ReferenceType = e.ReferenceType, ReferenceId = e.ReferenceId, DedupKey = e.DedupKey, CorrelationId = e.CorrelationId, Channel = e.Channel
        }, ct);
    }
}

public sealed class ContactReadModel(NotificationDbContext db) : IEmployeeReadModel
{
    public async Task UpsertAsync(EmployeeEvent e, CancellationToken ct)
    {
        var row = await db.EmployeeContacts.FirstOrDefaultAsync(c => c.EmployeeId == e.EmployeeId, ct);
        if (row is null) { row = new EmployeeContact { EmployeeId = e.EmployeeId }; db.EmployeeContacts.Add(row); }
        row.Email = e.WorkEmail; row.FullName = e.FullName; row.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
    }
}

public static class NotificationConsumerRegistration
{
    private static string D(DateOnly d) => d.ToString("yyyy-MM-dd");
    private static IEnumerable<NotifyRequest> None => [];

    public static IServiceCollection AddNotificationConsumers(this IServiceCollection s)
    {
        void Add<T>(string topic, Func<T, IEnumerable<NotifyRequest>> rule, Func<T, string?> employee) where T : IntegrationEvent =>
            s.AddScoped<IEventHandler>(sp => new TopicHandler<T>(topic, sp.GetRequiredService<INotificationService>(), rule, employee));
        NotifyRequest N(string type, string? to, Dictionary<string, string> vars, string? refType = null, string? refId = null) => new() { Type = type, RecipientEmployeeId = to, Variables = vars, ReferenceType = refType, ReferenceId = refId };

        // employee lifecycle (history only; contacts are kept by the read model)
        foreach (var t in new[] { Topics.EmployeeCreated, Topics.EmployeeUpdated, Topics.EmployeeTerminated }) Add<EmployeeEvent>(t, _ => None, e => e.EmployeeId);
        Add<EmployeeExitedEvent>(Topics.EmployeeExited, _ => None, e => e.EmployeeId);

        // leave
        LeaveRule(Topics.LeaveApplied, e => e.ManagerId is null ? None : [N("LEAVE_APPLIED", e.ManagerId, Vars(e, "employeeName", e.EmployeeName))]);
        LeaveRule(Topics.LeaveApproved, e => [N("LEAVE_APPROVED", e.EmployeeId, Vars(e, "comment", e.Comment ?? ""))]);
        LeaveRule(Topics.LeaveRejected, e => [N("LEAVE_REJECTED", e.EmployeeId, Vars(e, "comment", e.Comment ?? ""))]);
        LeaveRule(Topics.LeaveCancelled, e => [N("LEAVE_CANCELLED", e.EmployeeId, Vars(e, "comment", e.Comment ?? ""))]);
        void LeaveRule(string topic, Func<LeaveEvent, IEnumerable<NotifyRequest>> r) => Add(topic, r, (LeaveEvent e) => e.EmployeeId);
        static Dictionary<string, string> Vars(LeaveEvent e, string k, string v) => new() { ["leaveType"] = e.LeaveType, ["fromDate"] = D(e.FromDate), ["toDate"] = D(e.ToDate), ["days"] = e.Days.ToString("0.##"), [k] = v };

        // attendance
        Add<AttendanceEvent>(Topics.AttendanceCheckedIn, _ => None, e => e.EmployeeId);
        Add<AttendanceEvent>(Topics.AttendanceCheckedOut, _ => None, e => e.EmployeeId);
        Add<AttendanceEvent>(Topics.AttendanceCorrected, e => [N(e.Status == "CORRECTION_APPROVED" ? "CORRECTION_APPROVED" : "CORRECTION_REJECTED", e.EmployeeId, new() { ["date"] = D(e.WorkDate), ["comment"] = "" })], e => e.EmployeeId);

        // payroll / tax / performance / timesheet / exit
        Add<PayrollProcessedEvent>(Topics.PayrollProcessed, _ => None, _ => null);
        Add<PayslipGeneratedEvent>(Topics.PayslipGenerated, e => [N("PAYSLIP_AVAILABLE", e.EmployeeId, new() { ["month"] = $"{e.Year}-{e.Month:D2}" })], e => e.EmployeeId);
        Add<TaxDeclarationEvent>(Topics.TaxDeclarationSubmitted, _ => None, e => e.EmployeeId);
        Add<PerformanceReviewEvent>(Topics.PerformanceReviewSubmitted, e => e.Status == "SELF_SUBMITTED" && e.ManagerId is not null ? [N("REVIEW_MANAGER_TURN", e.ManagerId, new())] : None, e => e.EmployeeId);
        Add<TimesheetEvent>(Topics.TimesheetSubmitted, e => e.ManagerId is null ? None : [N("TIMESHEET_SUBMITTED", e.ManagerId, new() { ["weekStart"] = D(e.WeekStart), ["hours"] = e.TotalHours.ToString("0.##"), ["employeeName"] = "" }) with { Subject = "Timesheet submitted", Body = $"A timesheet for the week of {D(e.WeekStart)} ({e.TotalHours:0.##}h) awaits your approval." }], e => e.EmployeeId);
        Add<TimesheetEvent>(Topics.TimesheetApproved, e => [N("TIMESHEET_APPROVED", e.EmployeeId, new() { ["weekStart"] = D(e.WeekStart) }) with { Subject = "Timesheet approved", Body = $"Your timesheet for the week of {D(e.WeekStart)} was approved." }], e => e.EmployeeId);
        Add<ResignationEvent>(Topics.ResignationSubmitted, e => e.ManagerId is null ? None : [N("EXIT_RESIGNATION_SUBMITTED", e.ManagerId, new()) with { Subject = "Resignation submitted", Body = $"{e.EmployeeName} submitted a resignation (requested last working day {D(e.LastWorkingDay)})." }], e => e.EmployeeId);
        Add<ResignationEvent>(Topics.ResignationWithdrawn, _ => None, e => e.EmployeeId);
        s.AddScoped<IEventHandler, NotificationRequestedHandler>();
        return s;
    }
}
