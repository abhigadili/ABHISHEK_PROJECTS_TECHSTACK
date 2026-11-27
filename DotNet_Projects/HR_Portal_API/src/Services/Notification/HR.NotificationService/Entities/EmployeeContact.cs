using System;
using System.Collections.Generic;

namespace HR.NotificationService.Entities;

public partial class EmployeeContact
{
    public string EmployeeId { get; set; } = null!;

    public string? Email { get; set; }

    public string? FullName { get; set; }

    public DateTime UpdatedAt { get; set; }
}
