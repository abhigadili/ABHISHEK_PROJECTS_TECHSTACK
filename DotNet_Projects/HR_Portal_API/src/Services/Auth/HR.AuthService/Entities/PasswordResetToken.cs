using System;
using System.Collections.Generic;

namespace HR.AuthService.Entities;

public partial class PasswordResetToken
{
    public string Id { get; set; } = null!;

    public DateTime CreatedAt { get; set; }

    public string? CreatedBy { get; set; }

    public DateTime UpdatedAt { get; set; }

    public string? UpdatedBy { get; set; }

    public DateTime ExpiresAt { get; set; }

    public string TokenHash { get; set; } = null!;

    public DateTime? UsedAt { get; set; }

    public string UserId { get; set; } = null!;
}
