using System.ComponentModel.DataAnnotations;
using HR.Common.Common;
using Microsoft.AspNetCore.Http;

namespace HR.DocumentService.DTOs;

public sealed class UploadRequest
{
    [Required, StringLength(36, MinimumLength = 36)] public string CategoryId { get; set; } = "";
    [Required, StringLength(190)] public string Title { get; set; } = "";
    [StringLength(36)] public string? OwnerEmployeeId { get; set; }
    public DateOnly? ExpiryDate { get; set; }
    [RegularExpression("^(MANUAL|LEAVE|TAX)$")] public string Source { get; set; } = "MANUAL";
    [Required] public IFormFile? File { get; set; }
}

public sealed class CategoryRequest
{
    [Required, StringLength(40, MinimumLength = 2), RegularExpression("^[A-Z0-9_]+$")] public string Code { get; set; } = "";
    [Required, StringLength(120)] public string Name { get; set; } = "";
    [StringLength(255)] public string? Description { get; set; }
    [Required, MinLength(1)] public List<string> ReadRoles { get; set; } = [];
    public bool RequiresVerification { get; set; } = true;
    public bool SelfUploadAllowed { get; set; } = true;
    public bool IsSensitive { get; set; }
    [Range(1, 600)] public int? DefaultExpiryMonths { get; set; }
    public bool Active { get; set; } = true;
}
public sealed class CategoryUpdateRequest
{
    [StringLength(120)] public string? Name { get; set; }
    [StringLength(255)] public string? Description { get; set; }
    public List<string>? ReadRoles { get; set; }
    public bool? RequiresVerification { get; set; }
    public bool? SelfUploadAllowed { get; set; }
    public bool? IsSensitive { get; set; }
    [Range(1, 600)] public int? DefaultExpiryMonths { get; set; }
    public bool? Active { get; set; }
}
public sealed record CategoryDto(string Id, string Code, string Name, string? Description, List<string> ReadRoles, bool RequiresVerification, bool SelfUploadAllowed, bool IsSensitive, int? DefaultExpiryMonths, bool Active);

public sealed record DecisionRequest([StringLength(255)] string? Comment);
public sealed record RejectRequest([Required, StringLength(500, MinimumLength = 3)] string Reason);
public sealed class GrantRequest
{
    [Required, RegularExpression("^(EMPLOYEE|ROLE)$")] public string GranteeType { get; set; } = "";
    [Required, StringLength(64, MinimumLength = 1)] public string GranteeId { get; set; } = "";
    [RegularExpression("^(VIEW|DOWNLOAD)$")] public string AccessLevel { get; set; } = "VIEW";
    public DateTime? ExpiresAt { get; set; }
}
public sealed class DocumentListQuery : PageQuery
{
    public string? OwnerEmployeeId { get; set; }
    public string? CategoryId { get; set; }
    [RegularExpression("^(UPLOADED|VERIFIED|APPROVED|REJECTED)$")] public string? Status { get; set; }
    [RegularExpression("^(MANUAL|LEAVE|TAX|PAYSLIP|EXIT)$")] public string? Source { get; set; }
}
public sealed class ExpiringQuery { [Range(1, 365)] public int Days { get; set; } = 30; }

public sealed record DocumentDto(string Id, string Title, string OwnerEmployeeId, string CategoryId, string FileName, string ContentType, long SizeBytes, string Sha256, string Status, string Source, DateOnly? ExpiryDate,
    int VersionNumber, bool CurrentVersion, string? PreviousVersionId, string? RejectionReason, DateTime? DecidedAt, string? DecidedBy, string? UploadedBy, DateTime CreatedAt, DateTime UpdatedAt);
public sealed record VersionDto(string Id, int VersionNumber, bool CurrentVersion, string Status, DateTime CreatedAt, string FileName);
public sealed record HistoryDto(string Id, string Action, string? Detail, DateTime CreatedAt);
public sealed record DocumentDetailDto(DocumentDto Document, List<VersionDto> Versions, List<HistoryDto> History);
public sealed record GrantDto(string Id, string DocumentId, string GranteeType, string GranteeId, string AccessLevel, DateTime? ExpiresAt);
