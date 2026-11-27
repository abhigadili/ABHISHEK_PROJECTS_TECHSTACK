using System.ComponentModel.DataAnnotations;
using HMS.Prescriptions.Domain;

namespace HMS.Prescriptions.Dtos;

public sealed class ItemRequest
{
    [Required, StringLength(150)] public string MedicineName { get; set; } = "";
    [Required, StringLength(60)] public string Dosage { get; set; } = "";
    [Required, StringLength(80)] public string Frequency { get; set; } = "";
    [Required, Range(1, 365)] public int? DurationDays { get; set; }
    [Required, Range(1, 1000)] public int? Quantity { get; set; }
    [StringLength(255)] public string? Instructions { get; set; }
}

public sealed class PrescriptionRequest
{
    [Required] public long? PatientId { get; set; }
    [Required] public long? DoctorId { get; set; }
    public long? AppointmentId { get; set; }
    [StringLength(500)] public string? Diagnosis { get; set; }
    [StringLength(1000)] public string? Notes { get; set; }
    [Range(1, 365)] public int? ValidDays { get; set; }
    [Required, MinLength(1, ErrorMessage = "at least one medicine is required")] public List<ItemRequest> Items { get; set; } = [];
}

public sealed record ItemResponse(long Id, string MedicineName, string Dosage, string Frequency, int DurationDays, int Quantity, string? Instructions);

public sealed record PrescriptionResponse(long Id, long PatientId, string PatientName, long DoctorId, string DoctorName, long? AppointmentId, string? Diagnosis, string? Notes,
    PrescriptionStatus Status, DateOnly ValidUntil, DateTime IssuedAt, List<ItemResponse> Items)
{
    public static PrescriptionResponse From(Prescription p) => new(p.Id, p.PatientId, p.PatientName, p.DoctorId, p.DoctorName, p.AppointmentId, p.Diagnosis, p.Notes, p.Status, p.ValidUntil,
        p.IssuedAt, p.Items.Select(i => new ItemResponse(i.Id, i.MedicineName, i.Dosage, i.Frequency, i.DurationDays, i.Quantity, i.Instructions)).ToList());
}

public sealed record StatusResponse(long Id, PrescriptionStatus Status, DateTime? StatusChangedAt);
