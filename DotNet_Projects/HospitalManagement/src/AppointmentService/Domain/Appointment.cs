namespace HMS.Appointments.Domain;

public enum AppointmentStatus { BOOKED, CANCELLED, COMPLETED, MISSED }
public enum PaymentStatus { NOT_BILLED, PENDING, PAID, FAILED }

/// <summary>
/// Double-booking is prevented twice: by overlap checks in the service and by the unique "SlotKey" (doctor|date|start) that
/// exists only while the appointment is BOOKED - cancelling sets it to NULL so the slot can be booked again (MySQL allows many NULLs
/// in a unique index). Concurrent requests for the same slot therefore cannot both succeed.
/// </summary>
public class Appointment
{
    public long Id { get; set; }
    public long PatientId { get; set; }
    public long DoctorId { get; set; }
    public DateOnly AppointmentDate { get; set; }
    public TimeOnly StartTime { get; set; }
    public TimeOnly EndTime { get; set; }
    public AppointmentStatus Status { get; set; } = AppointmentStatus.BOOKED;
    public string? SlotKey { get; set; }
    public string? Reason { get; set; }
    public string? CancelReason { get; set; }
    public string? Notes { get; set; }
    public decimal Fee { get; set; }
    public PaymentStatus PaymentStatus { get; set; } = PaymentStatus.NOT_BILLED;
    public string? BillNumber { get; set; }
    /// <summary>Snapshots taken at booking time so notifications never need a synchronous lookup.</summary>
    public string PatientName { get; set; } = "";
    public string? PatientEmail { get; set; }
    public string DoctorName { get; set; } = "";
    public string? DoctorEmail { get; set; }
    public bool ReminderSent { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public DateTime StartsAt => AppointmentDate.ToDateTime(StartTime);
    public DateTime EndsAt => AppointmentDate.ToDateTime(EndTime);
    public static string MakeSlotKey(long doctorId, DateOnly date, TimeOnly start) => $"{doctorId}|{date:yyyy-MM-dd}|{start:HH:mm}";
}
