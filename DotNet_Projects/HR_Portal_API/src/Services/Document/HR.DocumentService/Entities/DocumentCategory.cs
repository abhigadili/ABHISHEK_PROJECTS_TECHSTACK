using System;
using System.Collections.Generic;

namespace HR.DocumentService.Entities;

public partial class DocumentCategory
{
    public string Id { get; set; } = null!;

    public DateTime CreatedAt { get; set; }

    public string? CreatedBy { get; set; }

    public DateTime UpdatedAt { get; set; }

    public string? UpdatedBy { get; set; }

    public bool Deleted { get; set; }

    public DateTime? DeletedAt { get; set; }

    public bool Active { get; set; }

    public string Code { get; set; } = null!;

    public int? DefaultExpiryMonths { get; set; }

    public string? Description { get; set; }

    public string Name { get; set; } = null!;

    public string ReadRoles { get; set; } = null!;

    public bool RequiresVerification { get; set; }

    public bool SelfUploadAllowed { get; set; }

    public bool IsSensitive { get; set; }

    public virtual ICollection<Document> Documents { get; set; } = new List<Document>();
}
