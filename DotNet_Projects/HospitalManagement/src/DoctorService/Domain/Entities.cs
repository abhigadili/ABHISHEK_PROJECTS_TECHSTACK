namespace HMS.Doctors.Domain;

public class Doctor
{
    public long Id { get; set; }
    /// <summary>Login account (role DOCTOR) in the identity service - logical reference. Lets a DOCTOR manage only their own schedule.</summary>
    public long? UserId { get; set; }
    public string FirstName { get; set; } = "";
    public string LastName { get; set; } = "";
    public string Email { get; set; } = "";
    public string? Phone { get; set; }
    public string LicenseNumber { get; set; } = "";
    public string Specialization { get; set; } = "";
    public string? Qualification { get; set; }
    public int? ExperienceYears { get; set; }
    public decimal ConsultationFee { get; set; }
    /// <summary>Logical references into HospitalDB, validated through the Hospital Service API (no cross-database FK).</summary>
    public long HospitalId { get; set; }
    public long? DepartmentId { get; set; }
    public bool Active { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public List<DoctorSchedule> Schedules { get; set; } = [];
    public List<DoctorUnavailability> Unavailability { get; set; } = [];

    public string FullName => $"Dr. {FirstName} {LastName}";
}

/// <summary>One working day of the weekly template: hours, slot length and an optional break.</summary>
public class DoctorSchedule
{
    public long Id { get; set; }
    public long DoctorId { get; set; }
    public Doctor? Doctor { get; set; }
    public DayOfWeek DayOfWeek { get; set; }
    public TimeOnly StartTime { get; set; }
    public TimeOnly EndTime { get; set; }
    public int SlotMinutes { get; set; }
    public TimeOnly? BreakStart { get; set; }
    public TimeOnly? BreakEnd { get; set; }
}

/// <summary>A full day off (leave, conference...).</summary>
public class DoctorUnavailability
{
    public long Id { get; set; }
    public long DoctorId { get; set; }
    public Doctor? Doctor { get; set; }
    public DateOnly UnavailableDate { get; set; }
    public string? Reason { get; set; }
}
