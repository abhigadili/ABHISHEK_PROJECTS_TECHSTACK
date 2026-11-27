using HMS.Notifications.Domain;
using HMS.Shared.Messaging;

namespace HMS.Notifications.Services;

/// <summary>Turns business events from every other service into patient / doctor notifications (queued; the delivery job sends them).</summary>
public sealed class PatientRegisteredHandler(INotificationAppService n) : KafkaEventHandler<PatientRegistered>
{
    public override string Topic => Topics.PatientRegistered;
    protected override Task HandleAsync(PatientRegistered e, CancellationToken ct) => n.QueueAsync(e.Email, e.Phone, Channel.EMAIL, "Welcome to the hospital",
        $"Hello {e.FirstName} {e.LastName}, your patient registration is complete. Your patient id is {e.PatientId}.", "PATIENT_REGISTERED", e.PatientId.ToString(), ct);
}

public sealed class AppointmentBookedHandler(INotificationAppService n) : KafkaEventHandler<AppointmentBooked>
{
    public override string Topic => Topics.AppointmentBooked;
    protected override async Task HandleAsync(AppointmentBooked e, CancellationToken ct)
    {
        var r = e.AppointmentId.ToString();
        await n.QueueAsync(e.PatientEmail, null, Channel.EMAIL, "Appointment confirmed",
            $"Your appointment with {e.DoctorName} is confirmed for {e.Date:yyyy-MM-dd} {e.StartTime:HH:mm}-{e.EndTime:HH:mm}. Consultation fee: {e.Fee}.", "APPOINTMENT_BOOKED", r, ct);
        await n.QueueAsync(e.DoctorEmail, null, Channel.EMAIL, "New appointment",
            $"New appointment with patient {e.PatientName} on {e.Date:yyyy-MM-dd} {e.StartTime:HH:mm}-{e.EndTime:HH:mm}.", "APPOINTMENT_BOOKED", r, ct);
    }
}

public sealed class AppointmentCancelledHandler(INotificationAppService n) : KafkaEventHandler<AppointmentCancelled>
{
    public override string Topic => Topics.AppointmentCancelled;
    protected override async Task HandleAsync(AppointmentCancelled e, CancellationToken ct)
    {
        var r = e.AppointmentId.ToString();
        var why = e.Reason is null ? "" : $" Reason: {e.Reason}.";
        await n.QueueAsync(e.PatientEmail, null, Channel.EMAIL, "Appointment cancelled", $"Your appointment with {e.DoctorName} on {e.Date:yyyy-MM-dd} {e.StartTime:HH:mm} was cancelled by {e.CancelledBy}.{why}", "APPOINTMENT_CANCELLED", r, ct);
        await n.QueueAsync(e.DoctorEmail, null, Channel.EMAIL, "Appointment cancelled", $"The appointment with {e.PatientName} on {e.Date:yyyy-MM-dd} {e.StartTime:HH:mm} was cancelled.{why}", "APPOINTMENT_CANCELLED", r, ct);
    }
}

public sealed class AppointmentRescheduledHandler(INotificationAppService n) : KafkaEventHandler<AppointmentRescheduled>
{
    public override string Topic => Topics.AppointmentRescheduled;
    protected override async Task HandleAsync(AppointmentRescheduled e, CancellationToken ct)
    {
        var r = e.AppointmentId.ToString();
        var msg = $"moved from {e.OldDate:yyyy-MM-dd} {e.OldStartTime:HH:mm} to {e.NewDate:yyyy-MM-dd} {e.NewStartTime:HH:mm}-{e.NewEndTime:HH:mm}";
        await n.QueueAsync(e.PatientEmail, null, Channel.EMAIL, "Appointment rescheduled", $"Your appointment with {e.DoctorName} was {msg}.", "APPOINTMENT_RESCHEDULED", r, ct);
        await n.QueueAsync(e.DoctorEmail, null, Channel.EMAIL, "Appointment rescheduled", $"Appointment with {e.PatientName} was {msg}.", "APPOINTMENT_RESCHEDULED", r, ct);
    }
}

public sealed class LabReportHandler(INotificationAppService n) : KafkaEventHandler<LabReportGenerated>
{
    public override string Topic => Topics.LabReportGenerated;
    protected override Task HandleAsync(LabReportGenerated e, CancellationToken ct) => n.QueueAsync(e.PatientEmail, null, Channel.EMAIL, "Lab report ready",
        $"Your report for '{e.TestName}' is ready{(e.Abnormal ? " (please consult your doctor: results flagged abnormal)" : "")}.", "LAB_REPORT_GENERATED", e.ReportId.ToString(), ct);
}

public sealed class PrescriptionHandler(INotificationAppService n) : KafkaEventHandler<PrescriptionCreated>
{
    public override string Topic => Topics.PrescriptionCreated;
    protected override Task HandleAsync(PrescriptionCreated e, CancellationToken ct) => n.QueueAsync(e.PatientEmail, null, Channel.EMAIL, "New prescription",
        $"{e.DoctorName} issued prescription #{e.PrescriptionId} with {e.Items.Count} medicine(s), valid until {e.ValidUntil:yyyy-MM-dd}.", "PRESCRIPTION_CREATED", e.PrescriptionId.ToString(), ct);
}

public sealed class BillingGeneratedHandler(INotificationAppService n) : KafkaEventHandler<BillingGenerated>
{
    public override string Topic => Topics.BillingGenerated;
    protected override Task HandleAsync(BillingGenerated e, CancellationToken ct) => n.QueueAsync(e.PatientEmail, null, Channel.EMAIL, $"New bill {e.BillNumber}",
        $"A bill of {e.Amount} ({e.BillType}) has been generated, due {e.DueDate:yyyy-MM-dd}.", "BILLING_GENERATED", e.BillId.ToString(), ct);
}

public sealed class PaymentCompletedHandler(INotificationAppService n) : KafkaEventHandler<PaymentCompleted>
{
    public override string Topic => Topics.PaymentCompleted;
    protected override Task HandleAsync(PaymentCompleted e, CancellationToken ct) => n.QueueAsync(e.PatientEmail, null, Channel.EMAIL, "Payment received",
        $"We received your payment of {e.Amount} for bill {e.BillNumber} (transaction {e.TransactionRef}). Thank you.", "PAYMENT_COMPLETED", e.TransactionRef, ct);
}

public sealed class PaymentFailedHandler(INotificationAppService n) : KafkaEventHandler<PaymentFailed>
{
    public override string Topic => Topics.PaymentFailed;
    protected override Task HandleAsync(PaymentFailed e, CancellationToken ct) => n.QueueAsync(e.PatientEmail, null, Channel.EMAIL, "Payment failed",
        $"Your payment of {e.Amount} for bill {e.BillNumber} failed: {e.Reason}. You can retry from your bills page.", "PAYMENT_FAILED", e.TransactionRef, ct);
}

public sealed class MedicineDispensedHandler(INotificationAppService n) : KafkaEventHandler<MedicineDispensed>
{
    public override string Topic => Topics.MedicineDispensed;
    protected override Task HandleAsync(MedicineDispensed e, CancellationToken ct) => n.QueueAsync(e.PatientEmail, null, Channel.EMAIL, "Medicines dispensed",
        $"Your medicines for prescription #{e.PrescriptionId} have been dispensed (total {e.TotalAmount}).", "MEDICINE_DISPENSED", e.OrderId.ToString(), ct);
}

/// <summary>Reminders and alerts raised by the schedulers of other services.</summary>
public sealed class NotificationRequestedHandler(INotificationAppService n) : KafkaEventHandler<NotificationRequested>
{
    public override string Topic => Topics.NotificationRequested;
    protected override Task HandleAsync(NotificationRequested e, CancellationToken ct) => n.QueueAsync(e.RecipientEmail, e.RecipientPhone,
        string.Equals(e.Channel, "SMS", StringComparison.OrdinalIgnoreCase) ? Channel.SMS : Channel.EMAIL, e.Subject, e.Message, e.EventType, e.ReferenceId, ct);
}
