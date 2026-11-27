using System.ComponentModel.DataAnnotations;
using HMS.Hospitals.Domain;

namespace HMS.Hospitals.Dtos;

public sealed class HospitalRequest
{
    [Required, StringLength(150)] public string Name { get; set; } = "";
    [Required, StringLength(30)] public string Code { get; set; } = "";
    [StringLength(255)] public string? Address { get; set; }
    [StringLength(80)] public string? City { get; set; }
    [StringLength(30)] public string? Phone { get; set; }
    [EmailAddress, StringLength(120)] public string? Email { get; set; }
}

public sealed record HospitalResponse(long Id, string Name, string Code, string? Address, string? City, string? Phone, string? Email, bool Active)
{
    public static HospitalResponse From(Hospital h) => new(h.Id, h.Name, h.Code, h.Address, h.City, h.Phone, h.Email, h.Active);
}

public sealed class DepartmentRequest
{
    [Required, StringLength(100)] public string Name { get; set; } = "";
    [StringLength(255)] public string? Description { get; set; }
}

public sealed record DepartmentResponse(long Id, long HospitalId, string Name, string? Description, bool Active)
{
    public static DepartmentResponse From(Department d) => new(d.Id, d.HospitalId, d.Name, d.Description, d.Active);
}

public sealed class LoginRequest
{
    [Required] public string Username { get; set; } = "";
    [Required] public string Password { get; set; } = "";
}

public sealed class RegisterRequest
{
    [Required, StringLength(60, MinimumLength = 4), RegularExpression(@"^[A-Za-z0-9._-]+$", ErrorMessage = "only letters, digits, '.', '_' and '-' are allowed")] public string Username { get; set; } = "";
    [Required, EmailAddress, StringLength(120)] public string Email { get; set; } = "";
    [Required, StringLength(72, MinimumLength = 8)] public string Password { get; set; } = "";
}

public sealed class CreateUserRequest
{
    [Required, StringLength(60, MinimumLength = 4), RegularExpression(@"^[A-Za-z0-9._-]+$")] public string Username { get; set; } = "";
    [Required, EmailAddress, StringLength(120)] public string Email { get; set; } = "";
    [Required, StringLength(72, MinimumLength = 8)] public string Password { get; set; } = "";
    [Required] public string Role { get; set; } = "";
}

public sealed class EnabledRequest
{
    [Required] public bool? Enabled { get; set; }
}

public sealed record UserResponse(long Id, string Username, string Email, string Role, bool Enabled);
public sealed record TokenResponse(string AccessToken, string TokenType, long ExpiresInSeconds, UserResponse User);
