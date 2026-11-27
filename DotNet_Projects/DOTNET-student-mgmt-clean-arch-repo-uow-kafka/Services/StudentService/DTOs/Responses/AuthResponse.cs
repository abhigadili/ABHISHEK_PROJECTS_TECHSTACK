namespace StudentMgmt.StudentService.DTOs.Responses;

public class AuthResponse
{
    public string AccessToken { get; set; } = default!;
    public DateTime AccessTokenExpiresAtUtc { get; set; }
    public string RefreshToken { get; set; } = default!;
    public DateTime RefreshTokenExpiresAtUtc { get; set; }
    public Guid UserId { get; set; }
    public string Email { get; set; } = default!;
    public string FullName { get; set; } = default!;
    public string[] Roles { get; set; } = Array.Empty<string>();

    /// <summary>
    /// The linked Student record's own id (distinct from UserId, which identifies
    /// the ApplicationUser login). Populated only when registration created a
    /// Student row (i.e. the Student role was assigned) — this is what callers
    /// must pass as studentId to EnrollmentService, not UserId.
    /// </summary>
    public Guid? StudentId { get; set; }
}
