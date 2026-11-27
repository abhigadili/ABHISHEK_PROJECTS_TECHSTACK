using System;
using System.Collections.Generic;

namespace HR.DocumentService.Entities;

public partial class DocumentHistory
{
    public string Id { get; set; } = null!;

    public DateTime CreatedAt { get; set; }

    public string? CreatedBy { get; set; }

    public DateTime UpdatedAt { get; set; }

    public string? UpdatedBy { get; set; }

    public string Action { get; set; } = null!;

    public string? Detail { get; set; }

    public string DocumentId { get; set; } = null!;

    public virtual Document Document { get; set; } = null!;
}
