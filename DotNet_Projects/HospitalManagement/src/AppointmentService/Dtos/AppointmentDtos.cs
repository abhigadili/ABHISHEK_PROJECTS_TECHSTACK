using System.ComponentModel.DataAnnotations;
using HMS.Appointments.Domain;
using HMS.Shared.Common;

namespace HMS.Appointments.Dtos;

public sealed class BookRequest
{
    [Required] public long? PatientId { get; set; }
    [Required] public long? DoctorId { get; set; }
    [Required, FutureOrToday] public DateOnly? Date { get; set; }
    [Required] public TimeOnly? StartTime { get; set; }
    [StringLength(255)] public string? Reason { get; set; }
}

public sealed class RescheduleRequest
{
    [Required, FutureOrToday] public DateOnly? Date { get; set; }
    [Required] public TimeOnly? StartTime { get; set; }
}

public sealed class CancelRequest { [StringLength(255)] public string? Reason { get; set; } }
public sealed class CompleteRequest { [StringLength(1000)] public string? Notes { get; set; } }

public sealed record AppointmentResponse(long Id, long PatientId, string PatientName, long DoctorId, string DoctorName, DateOnly Date, TimeOnly StartTime, TimeOnly EndTime,
    AppointmentStatus Status, string? Reason, string? CancelReason, string? Notes, decimal Fee, PaymentStatus PaymentStatus, string? BillNumber, DateTime CreatedAt)
{
    public static AppointmentResponse From(Appointment a) => new(a.Id, a.PatientId, a.PatientName, a.DoctorId, a.DoctorName, a.AppointmentDate, a.StartTime, a.EndTime,
        a.Status, a.Reason, a.CancelReason, a.Notes, a.Fee, a.PaymentStatus, a.BillNumber, a.CreatedAt);
}
