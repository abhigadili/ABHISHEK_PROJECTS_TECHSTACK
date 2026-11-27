using System;
using System.Collections.Generic;

namespace HR.AuthService.Entities;

public partial class UserAccount
{
    public string Id { get; set; } = null!;

    public DateTime CreatedAt { get; set; }

    public string? CreatedBy { get; set; }

    public DateTime UpdatedAt { get; set; }

    public string? UpdatedBy { get; set; }

    public string Email { get; set; } = null!;

    public string? EmployeeId { get; set; }

    public int FailedAttempts { get; set; }

    public DateTime? LastLoginAt { get; set; }

    public DateTime? LockedUntil { get; set; }

    public bool MustChangePassword { get; set; }

    public DateTime? PasswordChangedAt { get; set; }

    public string PasswordHash { get; set; } = null!;

    public string Status { get; set; } = null!;

    public string Username { get; set; } = null!;

    public long Version { get; set; }

    public virtual ICollection<Role> Roles { get; set; } = new List<Role>();
}
