namespace Common.Security;

/// <summary>Bound from the "Jwt" configuration section (environment: Jwt__Secret, Jwt__Issuer ...). The secret must be identical in the gateway and every service.</summary>
public class JwtOptions
{
    public const string Section = "Jwt";
    public string Secret { get; set; } = "";
    public string Issuer { get; set; } = "student-management";
    public string Audience { get; set; } = "student-management-api";
    public int AccessTokenMinutes { get; set; } = 15;
    public int RefreshTokenDays { get; set; } = 7;
}
