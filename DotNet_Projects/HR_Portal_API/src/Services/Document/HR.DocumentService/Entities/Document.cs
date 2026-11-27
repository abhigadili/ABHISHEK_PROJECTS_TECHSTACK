using System;
using System.Collections.Generic;

namespace HR.DocumentService.Entities;

public partial class Document
{
    public string Id { get; set; } = null!;

    public DateTime CreatedAt { get; set; }

    public string? CreatedBy { get; set; }

    public DateTime UpdatedAt { get; set; }

    public string? UpdatedBy { get; set; }

    public bool Deleted { get; set; }

    public DateTime? DeletedAt { get; set; }

    public string CategoryId { get; set; } = null!;

    public string ContentType { get; set; } = null!;

    public bool CurrentVersion { get; set; }

    public DateTime? DecidedAt { get; set; }

    public string? DecidedBy { get; set; }

    public DateOnly? ExpiryDate { get; set; }

    public string FileName { get; set; } = null!;

    public long OptimisticVersion { get; set; }

    public string OwnerEmployeeId { get; set; } = null!;

    public string? PreviousVersionId { get; set; }

    public string? RejectionReason { get; set; }

    public string Sha256 { get; set; } = null!;

    public long SizeBytes { get; set; }

    public string Source { get; set; } = null!;

    public string Status { get; set; } = null!;

    public string StoragePath { get; set; } = null!;

    public string Title { get; set; } = null!;

    public string? UploadedBy { get; set; }

    public int VersionNumber { get; set; }

    public virtual DocumentCategory Category { get; set; } = null!;

    public virtual ICollection<DocumentHistory> DocumentHistories { get; set; } = new List<DocumentHistory>();

    public virtual ICollection<DocumentPermission> DocumentPermissions { get; set; } = new List<DocumentPermission>();
}
