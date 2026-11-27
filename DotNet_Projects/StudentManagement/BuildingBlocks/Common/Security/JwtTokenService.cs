using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace Common.Security;

/// <summary>Creates HS256 access tokens (users and service-to-service) and builds the validation parameters shared by gateway and services.</summary>
public class JwtTokenService
{
    public const string StudentIdClaim = "studentId";
    private readonly JwtOptions _o;
    private readonly SymmetricSecurityKey _key;

    public JwtTokenService(IOptions<JwtOptions> options)
    {
        _o = options.Value;
        if (Encoding.UTF8.GetByteCount(_o.Secret) < 32)
            throw new InvalidOperationException("Jwt:Secret must be at least 32 characters (set Jwt__Secret).");
        _key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_o.Secret));
    }

    public TimeSpan AccessTtl => TimeSpan.FromMinutes(_o.AccessTokenMinutes);
    public TimeSpan RefreshTtl => TimeSpan.FromDays(_o.RefreshTokenDays);

    public string CreateAccessToken(string userId, string username, IEnumerable<string> roles, long? studentId)
        => Build(userId, username, roles, studentId, AccessTtl);

    /// <summary>5-minute token with role Service, used by Enrollment Service when it calls Student/Course Service.</summary>
    public string CreateServiceToken(string serviceName) => Build("0", serviceName, new[] { Roles.Service }, null, TimeSpan.FromMinutes(5));

    private string Build(string userId, string username, IEnumerable<string> roles, long? studentId, TimeSpan ttl)
    {
        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, userId),
            new(JwtRegisteredClaimNames.UniqueName, username),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString("N")),
        };
        claims.AddRange(roles.Select(r => new Claim(ClaimTypes.Role, r)));
        if (studentId.HasValue) claims.Add(new Claim(StudentIdClaim, studentId.Value.ToString()));
        var token = new JwtSecurityToken(_o.Issuer, _o.Audience, claims, DateTime.UtcNow, DateTime.UtcNow.Add(ttl),
            new SigningCredentials(_key, SecurityAlgorithms.HmacSha256));
        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    public static TokenValidationParameters ValidationParameters(JwtOptions o) => new()
    {
        ValidateIssuer = true, ValidIssuer = o.Issuer,
        ValidateAudience = true, ValidAudience = o.Audience,
        ValidateLifetime = true, ClockSkew = TimeSpan.FromSeconds(10),
        ValidateIssuerSigningKey = true,
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(o.Secret)),
        NameClaimType = JwtRegisteredClaimNames.UniqueName,
        RoleClaimType = ClaimTypes.Role,
    };
}
