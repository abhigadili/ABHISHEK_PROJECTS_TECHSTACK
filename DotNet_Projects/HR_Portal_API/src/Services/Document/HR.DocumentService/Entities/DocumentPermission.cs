using System;
using System.Collections.Generic;

namespace HR.DocumentService.Entities;

public partial class DocumentPermission
{
    public string Id { get; set; } = null!;

    public DateTime CreatedAt { get; set; }

    public string? CreatedBy { get; set; }

    public DateTime UpdatedAt { get; set; }

    public string? UpdatedBy { get; set; }

    public string AccessLevel { get; set; } = null!;

    public string DocumentId { get; set; } = null!;

    public DateTime? ExpiresAt { get; set; }

    public string GranteeId { get; set; } = null!;

    public string GranteeType { get; set; } = null!;

    public virtual Document Document { get; set; } = null!;
}
