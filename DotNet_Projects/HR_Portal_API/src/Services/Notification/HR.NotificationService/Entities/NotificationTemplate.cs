using System;
using System.Collections.Generic;

namespace HR.NotificationService.Entities;

public partial class NotificationTemplate
{
    public string Id { get; set; } = null!;

    public DateTime CreatedAt { get; set; }

    public string? CreatedBy { get; set; }

    public DateTime UpdatedAt { get; set; }

    public string? UpdatedBy { get; set; }

    public bool Active { get; set; }

    public string BodyTemplate { get; set; } = null!;

    public string Code { get; set; } = null!;

    public string? Description { get; set; }

    public string SubjectTemplate { get; set; } = null!;
}
