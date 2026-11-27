using System.ComponentModel.DataAnnotations;
using HMS.Doctors.Domain;

namespace HMS.Doctors.Dtos;

public sealed class DoctorRequest
{
    [Required, StringLength(60)] public string FirstName { get; set; } = "";
    [Required, StringLength(60)] public string LastName { get; set; } = "";
    [Required, EmailAddress, StringLength(120)] public string Email { get; set; } = "";
    [RegularExpression(@"^\+?[0-9]{7,15}$", ErrorMessage = "must be 7-15 digits, optional leading +")] public string? Phone { get; set; }
    [Required, StringLength(40)] public string LicenseNumber { get; set; } = "";
    [Required, StringLength(80)] public string Specialization { get; set; } = "";
    [StringLength(150)] public string? Qualification { get; set; }
    [Range(0, 70)] public int? ExperienceYears { get; set; }
    [Required, Range(0, 1000000)] public decimal? ConsultationFee { get; set; }
    [Required] public long? HospitalId { get; set; }
    public long? DepartmentId { get; set; }
    /// <summary>Login account (role DOCTOR) of this doctor, created beforehand in the identity service.</summary>
    public long? UserId { get; set; }
}

public sealed record DoctorResponse(long Id, long? UserId, string FullName, string FirstName, string LastName, string Email, string? Phone, string LicenseNumber,
    string Specialization, string? Qualification, int? ExperienceYears, decimal ConsultationFee, long HospitalId, long? DepartmentId, bool Active)
{
    public static DoctorResponse From(Doctor d) => new(d.Id, d.UserId, d.FullName, d.FirstName, d.LastName, d.Email, d.Phone, d.LicenseNumber, d.Specialization,
        d.Qualification, d.ExperienceYears, d.ConsultationFee, d.HospitalId, d.DepartmentId, d.Active);
}

public sealed class ScheduleEntry
{
    [Required] public DayOfWeek? DayOfWeek { get; set; }
    [Required] public TimeOnly? StartTime { get; set; }
    [Required] public TimeOnly? EndTime { get; set; }
    [Required, Range(5, 180)] public int? SlotMinutes { get; set; }
    public TimeOnly? BreakStart { get; set; }
    public TimeOnly? BreakEnd { get; set; }

    public static ScheduleEntry From(DoctorSchedule s) => new()
    {
        DayOfWeek = s.DayOfWeek, StartTime = s.StartTime, EndTime = s.EndTime, SlotMinutes = s.SlotMinutes, BreakStart = s.BreakStart, BreakEnd = s.BreakEnd
    };
}

public sealed class ScheduleRequest
{
    [Required] public List<ScheduleEntry> Days { get; set; } = [];
}

public sealed class UnavailabilityRequest
{
    [Required] public DateOnly? Date { get; set; }
    [StringLength(200)] public string? Reason { get; set; }
}

public sealed record UnavailabilityResponse(long Id, DateOnly Date, string? Reason);
public sealed record SlotDto(TimeOnly StartTime, TimeOnly EndTime, bool Available = true);
public sealed record AvailableDoctor(DoctorResponse Doctor, int SlotCount, TimeOnly? FirstSlot, TimeOnly? LastSlotEnd);
