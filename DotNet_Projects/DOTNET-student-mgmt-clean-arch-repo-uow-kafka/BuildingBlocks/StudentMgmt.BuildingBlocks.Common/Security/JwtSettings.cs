namespace StudentMgmt.BuildingBlocks.Common.Security;

/// <summary>
/// Bound from the "Jwt" section of appsettings.json (Options Pattern). The same
/// Secret/Issuer/Audience values are configured identically across all four
/// services so a token minted by student-service's AuthController validates
/// successfully on course-service, enrollment-service and notification-service
/// without any of them needing to call student-service over HTTP.
/// </summary>
public class JwtSettings
{
    public const string SectionName = "Jwt";

    public string Secret { get; set; } = default!;
    public string Issuer { get; set; } = "StudentManagementSystem";
    public string Audience { get; set; } = "StudentManagementSystem.Clients";
    public int AccessTokenExpirationMinutes { get; set; } = 30;
    public int RefreshTokenExpirationDays { get; set; } = 7;
}
