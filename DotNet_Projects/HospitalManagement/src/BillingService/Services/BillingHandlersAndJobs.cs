using HMS.Billing.Data;
using HMS.Billing.Domain;
using HMS.Shared.Hosting;
using HMS.Shared.Messaging;
using Microsoft.EntityFrameworkCore;

namespace HMS.Billing.Services;

/// <summary>Billing reacts to business events - it never has to be called synchronously by the other services.</summary>
public sealed class AppointmentBookedHandler(IBillingAppService svc) : KafkaEventHandler<AppointmentBooked>
{
    public override string Topic => Topics.AppointmentBooked;
    protected override Task HandleAsync(AppointmentBooked e, CancellationToken ct) => svc.GenerateFromEventAsync(BillType.APPOINTMENT, "APPOINTMENT", e.AppointmentId, e.PatientId, e.PatientName, e.PatientEmail,
        $"Consultation with {e.DoctorName} on {e.Date:yyyy-MM-dd} {e.StartTime:HH:mm}", e.Fee, 1, ct);
}

public sealed class AppointmentCancelledHandler(IBillingAppService svc) : KafkaEventHandler<AppointmentCancelled>
{
    public override string Topic => Topics.AppointmentCancelled;
    protected override Task HandleAsync(AppointmentCancelled e, CancellationToken ct) => svc.OnAppointmentCancelledAsync(e.AppointmentId, ct);
}

public sealed class LabTestRequestedHandler(IBillingAppService svc) : KafkaEventHandler<LabTestRequested>
{
    public override string Topic => Topics.LabTestRequested;
    protected override Task HandleAsync(LabTestRequested e, CancellationToken ct) => svc.GenerateFromEventAsync(BillType.LAB, "LAB_REQUEST", e.RequestId, e.PatientId, e.PatientName, e.PatientEmail,
        $"Lab test: {e.TestName} ({e.TestCode})", e.Price, 1, ct);
}

public sealed class MedicineDispensedHandler(IBillingAppService svc) : KafkaEventHandler<MedicineDispensed>
{
    public override string Topic => Topics.MedicineDispensed;
    protected override Task HandleAsync(MedicineDispensed e, CancellationToken ct) => svc.GenerateMedicineBillAsync(e, ct);
}

/// <summary>Payments stuck in PENDING (the customer never completed the gateway step) are failed, which also notifies the patient.</summary>
public sealed class StalePaymentsJob(IServiceScopeFactory scopes, IConfiguration cfg, ILogger<StalePaymentsJob> log)
    : PeriodicJob(scopes, cfg, log, "pending-payments", "Scheduler:PendingPaymentsIntervalSeconds", 60)
{
    protected override async Task RunAsync(IServiceProvider sp, CancellationToken ct)
    {
        var db = sp.GetRequiredService<BillingDbContext>();
        var svc = sp.GetRequiredService<IBillingAppService>();
        var cutoff = DateTime.UtcNow.AddMinutes(-cfg.GetValue("Billing:PendingPaymentTimeoutMinutes", 30));
        var stale = await db.Payments.Include(p => p.Bill).Where(p => p.Status == PaymentStatus.PENDING && p.InitiatedAt < cutoff).ToListAsync(ct);
        foreach (var p in stale) await svc.SettleAsync(p, PaymentStatus.FAILED, "Timed out waiting for payment confirmation", ct);
        if (stale.Count > 0) log.LogInformation("Pending-payment job: {Count} payment(s) timed out", stale.Count);
    }
}

/// <summary>Marks bills past their due date OVERDUE and reminds the patient (at most once per reminder interval).</summary>
public sealed class OverdueAndReminderJob(IServiceScopeFactory scopes, IConfiguration cfg, ILogger<OverdueAndReminderJob> log)
    : PeriodicJob(scopes, cfg, log, "overdue-and-reminders", "Scheduler:OverdueIntervalSeconds", 300)
{
    protected override async Task RunAsync(IServiceProvider sp, CancellationToken ct)
    {
        var db = sp.GetRequiredService<BillingDbContext>();
        var events = sp.GetRequiredService<IEventPublisher>();
        var today = DateOnly.FromDateTime(DateTime.Now);
        foreach (var b in await db.Bills.Where(x => x.Status == BillStatus.PENDING && x.DueDate < today).ToListAsync(ct))
        {
            b.Status = BillStatus.OVERDUE;
            log.LogInformation("Bill {BillNumber} is now OVERDUE", b.BillNumber);
        }
        var interval = TimeSpan.FromHours(cfg.GetValue("Billing:ReminderIntervalHours", 24));
        var now = DateTime.UtcNow;
        var remindable = await db.Bills.Where(x => (x.Status == BillStatus.PENDING || x.Status == BillStatus.OVERDUE) && x.CreatedAt < now - interval
            && (x.LastReminderAt == null || x.LastReminderAt < now - interval)).ToListAsync(ct);
        var n = 0;
        foreach (var b in remindable.Where(b => b.PatientEmail is not null))
        {
            events.Publish(Topics.NotificationRequested, $"bill-reminder-{b.Id}", new NotificationRequested(b.PatientEmail!, null, "EMAIL", $"Payment reminder: {b.BillNumber}",
                $"Your bill {b.BillNumber} of {b.Outstanding} {b.Currency} is {b.Status.ToString().ToLowerInvariant()} (due {b.DueDate:yyyy-MM-dd}). Please complete the payment.", "PAYMENT_REMINDER", b.Id.ToString()));
            b.LastReminderAt = now;
            n++;
        }
        await db.SaveChangesAsync(ct);
        if (n > 0) log.LogInformation("Billing reminder job: {Count} reminder(s) queued", n);
    }
}
