using System.ComponentModel.DataAnnotations;
using HR.Common.Common;

namespace HR.EmployeeService.DTOs;

public static class Rx
{
    public const string Phone = @"^[+0-9()\-\s]{7,20}$";
    public const string Pan = @"^[A-Z]{5}[0-9]{4}[A-Z]$";
}

public sealed class OnboardEmployeeRequest : IValidatableObject
{
    [Required, StringLength(80)] public string FirstName { get; set; } = "";
    [StringLength(80)] public string? MiddleName { get; set; }
    [Required, StringLength(80)] public string LastName { get; set; } = "";
    [Required, EmailAddress, StringLength(150)] public string WorkEmail { get; set; } = "";
    [EmailAddress, StringLength(150)] public string? PersonalEmail { get; set; }
    [RegularExpression(Rx.Phone)] public string? Phone { get; set; }
    [RegularExpression(Rx.Phone)] public string? AlternatePhone { get; set; }
    public DateOnly? DateOfBirth { get; set; }
    [RegularExpression("^(MALE|FEMALE|OTHER|UNDISCLOSED)$")] public string? Gender { get; set; }
    [RegularExpression("^(SINGLE|MARRIED|DIVORCED|WIDOWED)$")] public string? MaritalStatus { get; set; }
    [StringLength(5)] public string? BloodGroup { get; set; }
    [StringLength(60)] public string? Nationality { get; set; }
    [StringLength(40)] public string? NationalId { get; set; }
    [RegularExpression(Rx.Pan, ErrorMessage = "Invalid PAN")] public string? PanNumber { get; set; }
    [Required, StringLength(36, MinimumLength = 36)] public string DepartmentId { get; set; } = "";
    [Required, StringLength(36, MinimumLength = 36)] public string DesignationId { get; set; } = "";
    [Required, StringLength(36, MinimumLength = 36)] public string LocationId { get; set; } = "";
    [StringLength(36, MinimumLength = 36)] public string? JobGradeId { get; set; }
    [StringLength(36, MinimumLength = 36)] public string? ManagerId { get; set; }
    [RegularExpression("^(FULL_TIME|PART_TIME|CONTRACT|INTERN)$")] public string EmploymentType { get; set; } = "FULL_TIME";
    [Required] public DateOnly? JoiningDate { get; set; }
    public DateOnly? ConfirmationDate { get; set; }
    [Range(0, 365)] public int NoticePeriodDays { get; set; } = 60;

    public IEnumerable<ValidationResult> Validate(ValidationContext ctx)
    {
        if (DateOfBirth is { } dob && dob > DateOnly.FromDateTime(DateTime.UtcNow.AddYears(-16))) yield return new("Employee must be at least 16 years old", [nameof(DateOfBirth)]);
        if (ConfirmationDate is { } c && JoiningDate is { } j && c < j) yield return new("confirmationDate must not precede joiningDate", [nameof(ConfirmationDate)]);
        if (JoiningDate is { } jd && jd > DateOnly.FromDateTime(DateTime.UtcNow.AddYears(1))) yield return new("joiningDate is too far in the future", [nameof(JoiningDate)]);
    }
}

/// <summary>Partial update: only supplied (non-null) properties are applied. Version is the optimistic-lock token read by the client.</summary>
public sealed class UpdateEmployeeRequest
{
    [Required] public long? Version { get; set; }
    [StringLength(80)] public string? FirstName { get; set; }
    [StringLength(80)] public string? MiddleName { get; set; }
    [StringLength(80)] public string? LastName { get; set; }
    [EmailAddress, StringLength(150)] public string? WorkEmail { get; set; }
    [EmailAddress, StringLength(150)] public string? PersonalEmail { get; set; }
    [RegularExpression(Rx.Phone)] public string? Phone { get; set; }
    [RegularExpression(Rx.Phone)] public string? AlternatePhone { get; set; }
    public DateOnly? DateOfBirth { get; set; }
    [RegularExpression("^(MALE|FEMALE|OTHER|UNDISCLOSED)$")] public string? Gender { get; set; }
    [RegularExpression("^(SINGLE|MARRIED|DIVORCED|WIDOWED)$")] public string? MaritalStatus { get; set; }
    [StringLength(5)] public string? BloodGroup { get; set; }
    [StringLength(60)] public string? Nationality { get; set; }
    [StringLength(40)] public string? NationalId { get; set; }
    [RegularExpression(Rx.Pan, ErrorMessage = "Invalid PAN")] public string? PanNumber { get; set; }
    [StringLength(36, MinimumLength = 36)] public string? DepartmentId { get; set; }
    [StringLength(36, MinimumLength = 36)] public string? DesignationId { get; set; }
    [StringLength(36, MinimumLength = 36)] public string? LocationId { get; set; }
    [StringLength(36, MinimumLength = 36)] public string? JobGradeId { get; set; }
    [StringLength(36, MinimumLength = 36)] public string? ManagerId { get; set; }
    [RegularExpression("^(FULL_TIME|PART_TIME|CONTRACT|INTERN)$")] public string? EmploymentType { get; set; }
    public DateOnly? ConfirmationDate { get; set; }
    [Range(0, 365)] public int? NoticePeriodDays { get; set; }
}

public sealed record ChangeStatusRequest([Required, RegularExpression("^(ACTIVE|INACTIVE|ON_NOTICE|RESIGNED|TERMINATED)$")] string Status, [StringLength(255)] string? Reason, DateOnly? ExitDate);

public sealed class DirectoryQuery : PageQuery
{
    public string? DepartmentId { get; set; }
    public string? LocationId { get; set; }
    public string? DesignationId { get; set; }
    public string? ManagerId { get; set; }
    public string? Status { get; set; }
    public string? EmploymentType { get; set; }
    public string Key() => string.Join('|', Page, Size, Sort, Dir, Search, DepartmentId, LocationId, DesignationId, ManagerId, Status, EmploymentType);
}

public sealed record DirectoryEntryDto(string EmployeeId, string EmployeeCode, string? FullName, string WorkEmail, string DepartmentId, string DesignationId, string LocationId, string? ManagerId,
    string Status, string EmploymentType, DateOnly JoiningDate, int? TenureMonths);

public sealed record OrgRef(string Id, string? Code, string? Name);
public sealed record ManagerRef(string Id, string FullName, string EmployeeCode);

public sealed class EmployeeProfileDto
{
    public string Id { get; set; } = ""; public string EmployeeCode { get; set; } = "";
    public string FirstName { get; set; } = ""; public string? MiddleName { get; set; } = null; public string LastName { get; set; } = ""; public string FullName { get; set; } = "";
    public string WorkEmail { get; set; } = ""; public string? PersonalEmail { get; set; } public string? Phone { get; set; } public string? AlternatePhone { get; set; }
    public DateOnly? DateOfBirth { get; set; } public string? Gender { get; set; } public string? MaritalStatus { get; set; } public string? BloodGroup { get; set; } public string? Nationality { get; set; }
    public string? NationalId { get; set; } public string? PanNumber { get; set; }
    public string DepartmentId { get; set; } = ""; public string DesignationId { get; set; } = ""; public string? JobGradeId { get; set; } public string LocationId { get; set; } = ""; public string? ManagerId { get; set; }
    public string EmploymentType { get; set; } = ""; public DateOnly JoiningDate { get; set; } public DateOnly? ConfirmationDate { get; set; } public DateOnly? ExitDate { get; set; }
    public int NoticePeriodDays { get; set; } public string Status { get; set; } = ""; public long Version { get; set; } public DateTime CreatedAt { get; set; } public DateTime UpdatedAt { get; set; }
    public int? TenureMonths { get; set; } public OrgRef? Department { get; set; } public OrgRef? Designation { get; set; } public OrgRef? Location { get; set; } public ManagerRef? Manager { get; set; }
}

public sealed record EmployeeSummaryDto(string EmployeeId, string EmployeeCode, string FullName, string? WorkEmail, string? DepartmentId, string? DesignationId, string? LocationId, string? ManagerId,
    string Status, DateOnly? JoiningDate, DateOnly? ExitDate, string? Gender, int NoticePeriodDays, string EmploymentType);

public sealed record TeamMemberDto(string EmployeeId, string EmployeeCode, string FullName, string WorkEmail, string Status, string DesignationId);
public sealed record HeadcountDto(string DepartmentId, string Status, int Employees);

// ---- sub resources
public sealed record AddressRequest([Required, RegularExpression("^(CURRENT|PERMANENT|MAILING|OFFICE)$")] string Type, [Required, StringLength(190)] string Line1, [StringLength(190)] string? Line2,
    [Required, StringLength(80)] string City, [StringLength(80)] string? State, [StringLength(15)] string? PostalCode, [Required, StringLength(80)] string Country, bool Primary = false);
public sealed record AddressDto(string Id, string Type, string Line1, string? Line2, string City, string? State, string? PostalCode, string Country, bool Primary);

public sealed record EmergencyContactRequest([Required, StringLength(120)] string Name, [Required, StringLength(60)] string Relationship, [Required, RegularExpression(Rx.Phone)] string Phone,
    [RegularExpression(Rx.Phone)] string? AlternatePhone, [EmailAddress] string? Email, bool Primary = false);
public sealed record EmergencyContactDto(string Id, string Name, string Relationship, string Phone, string? AlternatePhone, string? Email, bool Primary);

public sealed record EducationRequest([Required, StringLength(120)] string Degree, [Required, StringLength(190)] string Institution, [StringLength(120)] string? FieldOfStudy,
    [Range(1950, 2100)] int? StartYear, [Range(1950, 2100)] int? EndYear, [StringLength(30)] string? Grade) : IValidatableObject
{
    public IEnumerable<ValidationResult> Validate(ValidationContext c) { if (StartYear is { } s && EndYear is { } e && e < s) yield return new("endYear must not precede startYear", [nameof(EndYear)]); }
}
public sealed record EducationDto(string Id, string Degree, string Institution, string? FieldOfStudy, int? StartYear, int? EndYear, string? Grade);

public sealed record ExperienceRequest([Required, StringLength(190)] string Company, [Required, StringLength(120)] string JobTitle, [Required] DateOnly? StartDate, DateOnly? EndDate, [StringLength(500)] string? Description) : IValidatableObject
{
    public IEnumerable<ValidationResult> Validate(ValidationContext c) { if (EndDate is { } e && StartDate is { } s && e < s) yield return new("endDate must not precede startDate", [nameof(EndDate)]); }
}
public sealed record ExperienceDto(string Id, string Company, string JobTitle, DateOnly StartDate, DateOnly? EndDate, string? Description, bool Verified);

public sealed record BankDetailRequest([Required, StringLength(120)] string AccountHolderName, [Required, StringLength(120)] string BankName, [Required, RegularExpression(@"^\d{6,20}$", ErrorMessage = "Invalid account number")] string AccountNumber,
    [RegularExpression(@"^[A-Z]{4}0[A-Z0-9]{6}$", ErrorMessage = "Invalid IFSC")] string? IfscCode, [StringLength(120)] string? Branch, [StringLength(30)] string? AccountType);
public sealed record BankDetailDto(string Id, string AccountHolderName, string BankName, string AccountNumber, string? IfscCode, string? Branch, string? AccountType);

public sealed record EmploymentHistoryDto(string Id, string ChangeType, DateOnly EffectiveDate, string? FromValue, string? ToValue, string? Reason, DateTime CreatedAt);
public sealed record ProfileChangeDto(string Id, string FieldName, string? OldValue, string? NewValue, string? ChangedBy, DateTime CreatedAt);
public sealed record StatusHistoryDto(long Id, string? OldStatus, string NewStatus, DateTime ChangedAt, string? ChangedBy);
