namespace HMS.Shared.Messaging;

/// <summary>Every integration event has a unique id (used for consumer idempotency) and an occurrence time.</summary>
public abstract record IntegrationEvent
{
    public Guid EventId { get; init; } = Guid.NewGuid();
    public DateTimeOffset OccurredAt { get; init; } = DateTimeOffset.UtcNow;
}

public static class Topics
{
    public const string PatientRegistered = "hospital.patient.registered";
    public const string AppointmentBooked = "hospital.appointment.booked";
    public const string AppointmentCancelled = "hospital.appointment.cancelled";
    public const string AppointmentRescheduled = "hospital.appointment.rescheduled";
    public const string AppointmentCompleted = "hospital.appointment.completed";
    public const string LabTestRequested = "hospital.lab.test-requested";
    public const string LabReportGenerated = "hospital.lab.report-generated";
    public const string PrescriptionCreated = "hospital.prescription.created";
    public const string BillingGenerated = "hospital.billing.generated";
    public const string PaymentCompleted = "hospital.payment.completed";
    public const string PaymentFailed = "hospital.payment.failed";
    public const string MedicineDispensed = "hospital.medicine.dispensed";
    public const string NotificationRequested = "hospital.notification.requested";

    public static readonly string[] All =
    [
        PatientRegistered, AppointmentBooked, AppointmentCancelled, AppointmentRescheduled, AppointmentCompleted, LabTestRequested,
        LabReportGenerated, PrescriptionCreated, BillingGenerated, PaymentCompleted, PaymentFailed, MedicineDispensed, NotificationRequested
    ];

    public static string Dlt(string topic) => topic + ".DLT";
}

public sealed record PatientRegistered(long PatientId, long? UserId, string FirstName, string LastName, string Email, string Phone) : IntegrationEvent;

public sealed record AppointmentBooked(long AppointmentId, long PatientId, string PatientName, string? PatientEmail, long DoctorId, string DoctorName,
    string? DoctorEmail, DateOnly Date, TimeOnly StartTime, TimeOnly EndTime, decimal Fee) : IntegrationEvent;

public sealed record AppointmentCancelled(long AppointmentId, long PatientId, string PatientName, string? PatientEmail, long DoctorId, string DoctorName,
    string? DoctorEmail, DateOnly Date, TimeOnly StartTime, string CancelledBy, string? Reason) : IntegrationEvent;

public sealed record AppointmentRescheduled(long AppointmentId, long PatientId, string PatientName, string? PatientEmail, long DoctorId, string DoctorName,
    string? DoctorEmail, DateOnly OldDate, TimeOnly OldStartTime, DateOnly NewDate, TimeOnly NewStartTime, TimeOnly NewEndTime) : IntegrationEvent;

public sealed record AppointmentCompleted(long AppointmentId, long PatientId, long DoctorId, string DoctorName, DateOnly Date, string? Notes) : IntegrationEvent;

public sealed record LabTestRequested(long RequestId, long PatientId, string PatientName, string? PatientEmail, long DoctorId, string TestCode, string TestName,
    decimal Price, string Priority) : IntegrationEvent;

public sealed record LabReportGenerated(long ReportId, long RequestId, long PatientId, string PatientName, string? PatientEmail, long DoctorId, string TestName,
    string Summary, bool Abnormal) : IntegrationEvent;

public sealed record PrescribedItem(string MedicineName, string Dosage, string Frequency, int DurationDays, int Quantity);

public sealed record PrescriptionCreated(long PrescriptionId, long PatientId, string PatientName, string? PatientEmail, long DoctorId, string DoctorName,
    DateOnly ValidUntil, string? Diagnosis, List<PrescribedItem> Items) : IntegrationEvent;

public sealed record BillingGenerated(long BillId, string BillNumber, long PatientId, string PatientName, string? PatientEmail, string BillType,
    string? ReferenceType, long? ReferenceId, decimal Amount, DateOnly DueDate) : IntegrationEvent;

public sealed record PaymentCompleted(long BillId, string BillNumber, string TransactionRef, long PatientId, string PatientName, string? PatientEmail,
    string? ReferenceType, long? ReferenceId, decimal Amount) : IntegrationEvent;

public sealed record PaymentFailed(long BillId, string BillNumber, string TransactionRef, long PatientId, string PatientName, string? PatientEmail,
    string? ReferenceType, long? ReferenceId, decimal Amount, string Reason) : IntegrationEvent;

public sealed record DispensedItem(string MedicineName, int Quantity, decimal UnitPrice);

public sealed record MedicineDispensed(long OrderId, long PrescriptionId, long PatientId, string PatientName, string? PatientEmail, decimal TotalAmount,
    List<DispensedItem> Items) : IntegrationEvent;

/// <summary>Generic request raised by schedulers (reminders, alerts) - delivered by the Notification Service.</summary>
public sealed record NotificationRequested(string RecipientEmail, string? RecipientPhone, string Channel, string Subject, string Message, string EventType,
    string? ReferenceId) : IntegrationEvent;
