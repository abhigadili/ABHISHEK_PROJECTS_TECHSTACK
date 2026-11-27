using System;
using System.Collections.Generic;

namespace HR.NotificationService.Entities;

public partial class EmailSetting
{
    public string Id { get; set; } = null!;

    public DateTime CreatedAt { get; set; }

    public string? CreatedBy { get; set; }

    public DateTime UpdatedAt { get; set; }

    public string? UpdatedBy { get; set; }

    public bool Enabled { get; set; }

    public string FromAddress { get; set; } = null!;

    public string? Host { get; set; }

    public string Mode { get; set; } = null!;

    public int? Port { get; set; }

    public bool StartTls { get; set; }

    public string? Username { get; set; }
}
