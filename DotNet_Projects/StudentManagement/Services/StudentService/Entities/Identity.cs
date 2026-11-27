using Microsoft.AspNetCore.Identity;

namespace StudentService.Entities;

/// <summary>Login account (ASP.NET Core Identity). StudentId links a Student-role account to its profile (same database, so a real FK).</summary>
public class AppUser : IdentityUser<long>
{
    public long? StudentId { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class AppRole : IdentityRole<long>
{
    public AppRole() { }
    public AppRole(string name) : base(name) { }
}

/// <summary>Opaque refresh token; only its SHA-256 hash is stored.</summary>
public class RefreshToken
{
    public long RefreshTokenId { get; set; }
    public long UserId { get; set; }
    public string TokenHash { get; set; } = "";
    public DateTime ExpiresAt { get; set; }
    public bool Revoked { get; set; }
    public DateTime CreatedAt { get; set; }
}
