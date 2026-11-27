namespace HMS.Patients.Domain;

public enum Gender { MALE, FEMALE, OTHER }
public enum PatientStatus { ACTIVE, INACTIVE }

/// <summary>Uniqueness: one profile per login (UserId) and no two patients share e-mail, phone or identity number.</summary>
public class Patient
{
    public long Id { get; set; }
    /// <summary>Login account in the Hospital (identity) service - a logical reference, no cross-database FK.</summary>
    public long? UserId { get; set; }
    public string FirstName { get; set; } = "";
    public string LastName { get; set; } = "";
    public DateOnly DateOfBirth { get; set; }
    public Gender Gender { get; set; }
    public string Email { get; set; } = "";
    public string Phone { get; set; } = "";
    public string? IdentityNumber { get; set; }
    public string? BloodGroup { get; set; }
    public string? Address { get; set; }
    public string? EmergencyContactName { get; set; }
    public string? EmergencyContactPhone { get; set; }
    public string? KnownAllergies { get; set; }
    public PatientStatus Status { get; set; } = PatientStatus.ACTIVE;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public string FullName => $"{FirstName} {LastName}";
}
