namespace HMS.Prescriptions.Domain;

public enum PrescriptionStatus { ACTIVE, DISPENSED, CANCELLED, EXPIRED }

public class Prescription
{
    public long Id { get; set; }
    public long PatientId { get; set; }
    public long DoctorId { get; set; }
    public long? AppointmentId { get; set; }
    public string PatientName { get; set; } = "";
    public string? PatientEmail { get; set; }
    public string DoctorName { get; set; } = "";
    public string? Diagnosis { get; set; }
    public string? Notes { get; set; }
    public PrescriptionStatus Status { get; set; } = PrescriptionStatus.ACTIVE;
    public DateOnly ValidUntil { get; set; }
    public DateTime IssuedAt { get; set; } = DateTime.UtcNow;
    public DateTime? StatusChangedAt { get; set; }
    public List<PrescriptionItem> Items { get; set; } = [];
}

public class PrescriptionItem
{
    public long Id { get; set; }
    public long PrescriptionId { get; set; }
    public Prescription? Prescription { get; set; }
    public string MedicineName { get; set; } = "";
    public string Dosage { get; set; } = "";
    public string Frequency { get; set; } = "";
    public int DurationDays { get; set; }
    public int Quantity { get; set; }
    public string? Instructions { get; set; }
}
