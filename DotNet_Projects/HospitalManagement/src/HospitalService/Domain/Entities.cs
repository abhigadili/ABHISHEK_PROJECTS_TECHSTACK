using Microsoft.AspNetCore.Identity;

namespace HMS.Hospitals.Domain;

public class Hospital
{
    public long Id { get; set; }
    public string Name { get; set; } = "";
    public string Code { get; set; } = "";
    public string? Address { get; set; }
    public string? City { get; set; }
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public bool Active { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public List<Department> Departments { get; set; } = [];
}

public class Department
{
    public long Id { get; set; }
    public long HospitalId { get; set; }
    public Hospital? Hospital { get; set; }
    public string Name { get; set; } = "";
    public string? Description { get; set; }
    public bool Active { get; set; } = true;
}

/// <summary>Login identity (ASP.NET Core Identity user). Profile data lives in the owning services, which reference this id as UserId.</summary>
public class AppUser : IdentityUser<long>
{
    public bool IsEnabled { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? LastLoginAt { get; set; }
}
