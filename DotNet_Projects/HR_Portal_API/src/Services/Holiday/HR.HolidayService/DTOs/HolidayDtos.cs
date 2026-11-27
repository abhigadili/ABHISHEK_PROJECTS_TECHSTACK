using System.ComponentModel.DataAnnotations;

namespace HR.HolidayService.DTOs;

public sealed class HolidayRequest : IValidatableObject
{
    [Required, StringLength(150)] public string Name { get; set; } = "";
    [Required] public DateOnly? Date { get; set; }
    [RegularExpression("^(MANDATORY|OPTIONAL|RESTRICTED)$")] public string Type { get; set; } = "MANDATORY";
    [StringLength(255)] public string? Description { get; set; }
    public List<string> LocationIds { get; set; } = [];
    public List<string> DepartmentIds { get; set; } = [];
    public IEnumerable<ValidationResult> Validate(ValidationContext c)
    {
        if (LocationIds.Concat(DepartmentIds).Any(i => i.Length != 36)) yield return new("scope ids must be valid ids", [nameof(LocationIds)]);
    }
}

/// <summary>Partial update: unset fields keep their value; scope lists replace the existing scopes only when supplied.</summary>
public sealed class HolidayUpdateRequest
{
    [StringLength(150)] public string? Name { get; set; }
    public DateOnly? Date { get; set; }
    [RegularExpression("^(MANDATORY|OPTIONAL|RESTRICTED)$")] public string? Type { get; set; }
    [StringLength(255)] public string? Description { get; set; }
    public List<string>? LocationIds { get; set; }
    public List<string>? DepartmentIds { get; set; }
}

public sealed record HolidayDto(string Id, string Name, DateOnly HolidayDate, int HolidayYear, string Type, string? Description, List<string> LocationIds, List<string> DepartmentIds);

public sealed class HolidayQuery
{
    public int? Year { get; set; }
    public DateOnly? From { get; set; }
    public DateOnly? To { get; set; }
    public string? LocationId { get; set; }
    public string? DepartmentId { get; set; }
    public string? Type { get; set; }
}

public sealed class UpcomingQuery { public string? LocationId { get; set; } public string? DepartmentId { get; set; } [Range(1, 100)] public int Limit { get; set; } = 10; }
public sealed class CountQuery { [Required] public DateOnly? From { get; set; } [Required] public DateOnly? To { get; set; } public string? LocationId { get; set; } public string? DepartmentId { get; set; } }

public sealed record MonthDto(string Month, List<HolidayDto> Holidays);
public sealed record CalendarDto(int Year, List<MonthDto> Months, int Total);
public sealed record HolidayCountDto(DateOnly From, DateOnly To, int Count, List<DateOnly> Dates);

public sealed class HolidayYearRequest : IValidatableObject
{
    [Required, Range(2000, 2200)] public int? YearNumber { get; set; }
    [Required] public DateOnly? StartDate { get; set; }
    [Required] public DateOnly? EndDate { get; set; }
    [StringLength(255)] public string? Description { get; set; }
    public bool? Active { get; set; }
    public IEnumerable<ValidationResult> Validate(ValidationContext c) { if (EndDate < StartDate) yield return new("endDate must not precede startDate", [nameof(EndDate)]); }
}
public sealed class HolidayYearUpdateRequest { public DateOnly? StartDate { get; set; } public DateOnly? EndDate { get; set; } [StringLength(255)] public string? Description { get; set; } public bool? Active { get; set; } }
public sealed record HolidayYearDto(string Id, int YearNumber, DateOnly StartDate, DateOnly EndDate, string? Description, bool Active);
