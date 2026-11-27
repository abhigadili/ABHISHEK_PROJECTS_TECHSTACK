using System;
using System.Collections.Generic;

namespace HR.AuthService.Entities;

public partial class RefreshToken
{
    public string Id { get; set; } = null!;

    public DateTime CreatedAt { get; set; }

    public string? CreatedBy { get; set; }

    public DateTime UpdatedAt { get; set; }

    public string? UpdatedBy { get; set; }

    public string? AccessTokenId { get; set; }

    public DateTime ExpiresAt { get; set; }

    public string? IpAddress { get; set; }

    public DateTime? RevokedAt { get; set; }

    public string TokenHash { get; set; } = null!;

    public string UserId { get; set; } = null!;
}
