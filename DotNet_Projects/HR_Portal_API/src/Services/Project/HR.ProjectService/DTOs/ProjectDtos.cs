using System.ComponentModel.DataAnnotations;
using HR.Common.Common;

namespace HR.ProjectService.DTOs;

public sealed class ContactRequest { [Required, StringLength(150)] public string Name { get; set; } = ""; [EmailAddress, StringLength(150)] public string? Email { get; set; } [StringLength(25)] public string? Phone { get; set; } [StringLength(100)] public string? Designation { get; set; } public bool Primary { get; set; } }
public sealed record ContactDto(string Id, string Name, string? Email, string? Phone, string? Designation, bool IsPrimary);
public sealed record CustomerProjectItem(string Id, string Code, string Name, string Status);
public sealed record CustomerDetailDto(CustomerDto Customer, List<ContactDto> Contacts, List<CustomerProjectItem> Projects);

public sealed class ProjectRequest : IValidatableObject
{
    [Required, StringLength(40, MinimumLength = 2), RegularExpression("^[A-Za-z0-9_-]+$")] public string Code { get; set; } = "";
    [Required, StringLength(190)] public string Name { get; set; } = "";
    [StringLength(1000)] public string? Description { get; set; }
    [Required, StringLength(36, MinimumLength = 36)] public string CustomerId { get; set; } = "";
    [Required, StringLength(36, MinimumLength = 36)] public string ProjectManagerId { get; set; } = "";
    [Required] public DateOnly? StartDate { get; set; }
    public DateOnly? EndDate { get; set; }
    [Range(0, double.MaxValue)] public decimal? Budget { get; set; }
    [StringLength(3, MinimumLength = 3)] public string Currency { get; set; } = "INR";
    [RegularExpression("^(TIME_AND_MATERIAL|FIXED_PRICE|RETAINER|NON_BILLABLE)$")] public string BillingModel { get; set; } = "TIME_AND_MATERIAL";
    [Range(0, double.MaxValue)] public decimal? BillingRate { get; set; }
    [StringLength(36, MinimumLength = 36)] public string? BillingContactId { get; set; }
    [StringLength(500)] public string? BillingNotes { get; set; }
    public IEnumerable<ValidationResult> Validate(ValidationContext c) { if (EndDate < StartDate) yield return new("endDate must not precede startDate", [nameof(EndDate)]); }
}

public sealed class ProjectUpdateRequest
{
    [Required] public long? Version { get; set; }
    [StringLength(40, MinimumLength = 2), RegularExpression("^[A-Za-z0-9_-]+$")] public string? Code { get; set; }
    [StringLength(190)] public string? Name { get; set; }
    [StringLength(1000)] public string? Description { get; set; }
    [StringLength(36, MinimumLength = 36)] public string? ProjectManagerId { get; set; }
    public DateOnly? StartDate { get; set; }
    public DateOnly? EndDate { get; set; }
    [Range(0, double.MaxValue)] public decimal? Budget { get; set; }
    [StringLength(3, MinimumLength = 3)] public string? Currency { get; set; }
    [RegularExpression("^(TIME_AND_MATERIAL|FIXED_PRICE|RETAINER|NON_BILLABLE)$")] public string? BillingModel { get; set; }
    [Range(0, double.MaxValue)] public decimal? BillingRate { get; set; }
    [StringLength(36, MinimumLength = 36)] public string? BillingContactId { get; set; }
    [StringLength(500)] public string? BillingNotes { get; set; }
}
public sealed record ChangeStatusRequest([Required, RegularExpression("^(PLANNED|ACTIVE|ON_HOLD|COMPLETED|CANCELLED)$")] string Status, [StringLength(255)] string? Reason);
public sealed class ProjectListQuery : PageQuery
{
    [RegularExpression("^(PLANNED|ACTIVE|ON_HOLD|COMPLETED|CANCELLED)$")] public string? Status { get; set; }
    public string? CustomerId { get; set; }
    public string? ProjectManagerId { get; set; }
}

/// <summary>Project allocation percentage: 1-100 in 0.5 steps (custom validation attribute).</summary>
[AttributeUsage(AttributeTargets.Property | AttributeTargets.Parameter)]
public sealed class AllocationPercentAttribute : ValidationAttribute
{
    public override bool IsValid(object? value) => value is null || (value is decimal d && d >= 1 && d <= 100 && d * 2 % 1 == 0);
    public override string FormatErrorMessage(string name) => "must be between 1 and 100 in 0.5 steps";
}
public sealed class AllocationRequest : IValidatableObject
{
    [Required, StringLength(36, MinimumLength = 36)] public string EmployeeId { get; set; } = "";
    [Required, StringLength(80)] public string Role { get; set; } = "";
    [Required, AllocationPercent] public decimal? AllocationPercent { get; set; }
    public bool Billable { get; set; } = true;
    [Required] public DateOnly? StartDate { get; set; }
    public DateOnly? EndDate { get; set; }
    public IEnumerable<ValidationResult> Validate(ValidationContext c) { if (EndDate < StartDate) yield return new("endDate must not precede startDate", [nameof(EndDate)]); }
}
public sealed class AllocationUpdateRequest { [StringLength(80)] public string? Role { get; set; } [AllocationPercent] public decimal? AllocationPercent { get; set; } public bool? Billable { get; set; } public DateOnly? EndDate { get; set; } }
public sealed record EndAllocationRequest(DateOnly? EndDate);
public sealed record OnDateQuery(DateOnly? Date);
public sealed class AllocationCheckQuery { [Required] public string EmployeeId { get; set; } = ""; [Required] public DateOnly? Date { get; set; } }

public sealed record ProjectDto(string Id, string Code, string Name, string? Description, string CustomerId, string ProjectManagerId, DateOnly StartDate, DateOnly? EndDate, string Status, long Version,
    DateTime CreatedAt, DateTime UpdatedAt, string? BillingModel, decimal? BillingRate, string? BillingContactId, string? BillingNotes, decimal? Budget, string? Currency);
public sealed record AllocationDto(string Id, string ProjectId, string EmployeeId, string? EmployeeName, string Role, decimal AllocationPercent, bool Billable, DateOnly StartDate, DateOnly? EndDate, string Status);
public sealed record ProjectDetailDto(ProjectDto Project, List<AllocationDto> Team);
public sealed record ProjectHistoryDto(string Id, string ChangeType, string? OldValue, string? NewValue, DateTime CreatedAt, string? CreatedBy);
public sealed record AllocationCheckDto(string ProjectId, string ProjectCode, string ProjectStatus, string ProjectManagerId, string EmployeeId, DateOnly Date, bool Allocated, decimal AllocationPercent, bool Billable);
public sealed record EmployeeProjectDto(string AllocationId, string ProjectId, string ProjectCode, string ProjectName, string ProjectStatus, string CustomerName, string Role, decimal AllocationPercent, bool Billable, DateOnly StartDate, DateOnly? EndDate, string AllocationStatus);
public sealed record EmployeeLite(string EmployeeId, string FullName, string Status);
