using System.ComponentModel.DataAnnotations;
using HMS.Patients.Domain;
using HMS.Shared.Common;

namespace HMS.Patients.Dtos;

public sealed class PatientRequest
{
    [Required, StringLength(60)] public string FirstName { get; set; } = "";
    [Required, StringLength(60)] public string LastName { get; set; } = "";
    [Required, PastDate] public DateOnly? DateOfBirth { get; set; }
    [Required] public Gender? Gender { get; set; }
    [Required, EmailAddress, StringLength(120)] public string Email { get; set; } = "";
    [Required, RegularExpression(@"^\+?[0-9]{7,15}$", ErrorMessage = "must be 7-15 digits, optional leading +")] public string Phone { get; set; } = "";
    [StringLength(40)] public string? IdentityNumber { get; set; }
    [RegularExpression(@"^(A|B|AB|O)[+-]$", ErrorMessage = "must be A+, A-, B+, B-, AB+, AB-, O+ or O-")] public string? BloodGroup { get; set; }
    [StringLength(255)] public string? Address { get; set; }
    [StringLength(100)] public string? EmergencyContactName { get; set; }
    [RegularExpression(@"^\+?[0-9]{7,15}$", ErrorMessage = "must be 7-15 digits, optional leading +")] public string? EmergencyContactPhone { get; set; }
    [StringLength(500)] public string? KnownAllergies { get; set; }
    /// <summary>Only honoured when an ADMIN registers a patient for an existing login; PATIENT callers always use their own id.</summary>
    public long? UserId { get; set; }
}

public sealed record PatientResponse(long Id, long? UserId, string FirstName, string LastName, DateOnly DateOfBirth, Gender Gender, string Email, string Phone,
    string? IdentityNumber, string? BloodGroup, string? Address, string? EmergencyContactName, string? EmergencyContactPhone, string? KnownAllergies,
    PatientStatus Status, DateTime CreatedAt, DateTime UpdatedAt)
{
    public static PatientResponse From(Patient p) => new(p.Id, p.UserId, p.FirstName, p.LastName, p.DateOfBirth, p.Gender, p.Email, p.Phone, p.IdentityNumber,
        p.BloodGroup, p.Address, p.EmergencyContactName, p.EmergencyContactPhone, p.KnownAllergies, p.Status, p.CreatedAt, p.UpdatedAt);
}

/// <summary>Minimal projection other services may see (no clinical data).</summary>
public sealed record PatientSummaryResponse(long Id, long? UserId, string FullName, string Email, string Phone, string Status);
