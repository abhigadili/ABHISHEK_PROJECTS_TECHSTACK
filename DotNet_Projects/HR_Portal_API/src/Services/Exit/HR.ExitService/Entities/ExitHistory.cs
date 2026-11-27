using System;
using System.Collections.Generic;

namespace HR.ExitService.Entities;

public partial class ExitHistory
{
    public string Id { get; set; } = null!;

    public DateTime CreatedAt { get; set; }

    public string? CreatedBy { get; set; }

    public DateTime UpdatedAt { get; set; }

    public string? UpdatedBy { get; set; }

    public string? Comment { get; set; }

    public string? FromStatus { get; set; }

    public string ResignationId { get; set; } = null!;

    public string ToStatus { get; set; } = null!;

    public virtual Resignation Resignation { get; set; } = null!;
}
