using HMS.Appointments.Data;
using HMS.Appointments.Domain;
using HMS.Shared.Cache;
using HMS.Shared.Hosting;
using HMS.Shared.Messaging;
using Microsoft.EntityFrameworkCore;

namespace HMS.Appointments.Services;

/// <summary>Keeps the appointment's payment status in sync with Billing - purely event driven, no synchronous coupling.</summary>
public sealed class BillingGeneratedHandler(IAppointmentAppService service) : KafkaEventHandler<BillingGenerated>
{
    public override string Topic => Topics.BillingGenerated;
    protected override Task HandleAsync(BillingGenerated e, CancellationToken ct) =>
        e.ReferenceType == "APPOINTMENT" && e.ReferenceId is { } id ? service.ApplyBillingAsync(id, e.BillNumber, PaymentStatus.PENDING, ct) : Task.CompletedTask;
}

public sealed class PaymentCompletedHandler(IAppointmentAppService service) : KafkaEventHandler<PaymentCompleted>
{
    public override string Topic => Topics.PaymentCompleted;
    protected override Task HandleAsync(PaymentCompleted e, CancellationToken ct) =>
        e.ReferenceType == "APPOINTMENT" && e.ReferenceId is { } id ? service.ApplyBillingAsync(id, e.BillNumber, PaymentStatus.PAID, ct) : Task.CompletedTask;
}

public sealed class PaymentFailedHandler(IAppointmentAppService service) : KafkaEventHandler<PaymentFailed>
{
    public override string Topic => Topics.PaymentFailed;
    protected override Task HandleAsync(PaymentFailed e, CancellationToken ct) =>
        e.ReferenceType == "APPOINTMENT" && e.ReferenceId is { } id ? service.ApplyBillingAsync(id, e.BillNumber, PaymentStatus.FAILED, ct) : Task.CompletedTask;
}

/// <summary>Hosted scheduler: finds BOOKED appointments starting within the lead window and asks the Notification Service (via Kafka) to remind patient and doctor.</summary>
public sealed class ReminderJob(IServiceScopeFactory scopes, IConfiguration cfg, ILogger<ReminderJob> log)
    : PeriodicJob(scopes, cfg, log, "appointment-reminders", "Scheduler:ReminderIntervalSeconds", 60)
{
    protected override async Task RunAsync(IServiceProvider sp, CancellationToken ct)
    {
        var db = sp.GetRequiredService<AppointmentDbContext>();
        var events = sp.GetRequiredService<IEventPublisher>();
        var now = DateTime.Now;
        var limit = now.AddHours(cfg.GetValue("Scheduler:ReminderLeadHours", 24));
        var candidates = await db.Appointments.Where(a => a.Status == AppointmentStatus.BOOKED && !a.ReminderSent
            && a.AppointmentDate >= DateOnly.FromDateTime(now) && a.AppointmentDate <= DateOnly.FromDateTime(limit)).ToListAsync(ct);
        var sent = 0;
        foreach (var a in candidates.Where(a => a.StartsAt >= now && a.StartsAt <= limit))
        {
            var when = $"{a.AppointmentDate:yyyy-MM-dd} {a.StartTime:HH:mm}";
            if (a.PatientEmail is not null)
                events.Publish(Topics.NotificationRequested, $"appt-reminder-{a.Id}", new NotificationRequested(a.PatientEmail, null, "EMAIL", "Appointment reminder",
                    $"Reminder: you have an appointment with {a.DoctorName} on {when}.", "APPOINTMENT_REMINDER", a.Id.ToString()));
            if (a.DoctorEmail is not null)
                events.Publish(Topics.NotificationRequested, $"appt-reminder-{a.Id}", new NotificationRequested(a.DoctorEmail, null, "EMAIL", "Upcoming appointment",
                    $"Reminder: appointment with patient {a.PatientName} on {when}.", "APPOINTMENT_REMINDER", a.Id.ToString()));
            a.ReminderSent = true;
            sent++;
        }
        if (sent > 0)
        {
            await db.SaveChangesAsync(ct);    // reminders + outbox rows commit together
            log.LogInformation("Appointment reminder job: {Count} reminder(s) queued", sent);
        }
    }
}

/// <summary>BOOKED appointments whose end time is long past were never attended: mark them MISSED and free the slot key.</summary>
public sealed class MissedAppointmentsJob(IServiceScopeFactory scopes, IConfiguration cfg, ILogger<MissedAppointmentsJob> log)
    : PeriodicJob(scopes, cfg, log, "missed-appointments", "Scheduler:MissedIntervalSeconds", 300)
{
    protected override async Task RunAsync(IServiceProvider sp, CancellationToken ct)
    {
        var db = sp.GetRequiredService<AppointmentDbContext>();
        var cache = sp.GetRequiredService<ICacheService>();
        var cutoff = DateTime.Now.AddHours(-2);
        var rows = (await db.Appointments.Where(a => a.Status == AppointmentStatus.BOOKED && a.AppointmentDate <= DateOnly.FromDateTime(DateTime.Now)).ToListAsync(ct)).Where(a => a.EndsAt < cutoff).ToList();
        if (rows.Count == 0) return;
        foreach (var a in rows) { a.Status = AppointmentStatus.MISSED; a.SlotKey = null; a.UpdatedAt = DateTime.UtcNow; }
        await db.SaveChangesAsync(ct);
        foreach (var a in rows) await cache.RemoveManyAsync([$"appointment:{a.Id}", $"availability:{a.DoctorId}:{a.AppointmentDate:yyyy-MM-dd}"], ct);
        log.LogInformation("Missed-appointment job: {Count} appointment(s) marked MISSED", rows.Count);
    }
}
