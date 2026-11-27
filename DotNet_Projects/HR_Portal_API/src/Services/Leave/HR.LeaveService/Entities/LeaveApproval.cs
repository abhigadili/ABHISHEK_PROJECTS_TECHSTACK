using System;
using System.Collections.Generic;

namespace HR.LeaveService.Entities;

public partial class LeaveApproval
{
    public string Id { get; set; } = null!;

    public DateTime CreatedAt { get; set; }

    public string? CreatedBy { get; set; }

    public DateTime UpdatedAt { get; set; }

    public string? UpdatedBy { get; set; }

    public string Action { get; set; } = null!;

    public string? ActorId { get; set; }

    public string ApplicationId { get; set; } = null!;

    public string? Comment { get; set; }

    public string Stage { get; set; } = null!;
}
