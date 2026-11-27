using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using HR.Common.Cache;
using Microsoft.IdentityModel.Tokens;

namespace HR.Common.Security;

public sealed class JwtOptions
{
    public string Key { get; set; } = "";
    public string Issuer { get; set; } = "hr-portal-dotnet";
    public string Audience { get; set; } = "hr-portal-api";
    public int AccessTtlSeconds { get; set; } = 900;
    public int RefreshTtlSeconds { get; set; } = 604800;
}

public sealed record AccessToken(string Token, string Jti, DateTime ExpiresAtUtc);

/// <summary>Issues signed access tokens (HS256). Only the Auth Service uses it.</summary>
public sealed class JwtTokenIssuer(Microsoft.Extensions.Options.IOptions<JwtOptions> options)
{
    private readonly JwtOptions _o = options.Value;

    public AccessToken Issue(string userId, string username, string email, string? employeeId, IEnumerable<string> roles, IEnumerable<string> permissions)
    {
        var jti = Guid.NewGuid().ToString("N");
        var now = DateTime.UtcNow;
        var expires = now.AddSeconds(_o.AccessTtlSeconds);
        var claims = new List<Claim>
        {
            new("sub", userId), new("unique_name", username), new("email", email), new("jti", jti),
            new("iat", new DateTimeOffset(now).ToUnixTimeSeconds().ToString(), ClaimValueTypes.Integer64)
        };
        if (employeeId is not null) claims.Add(new("eid", employeeId));
        claims.AddRange(roles.Distinct().Select(r => new Claim("role", r)));
        claims.AddRange(permissions.Distinct().Select(p => new Claim("perm", p)));
        var creds = new SigningCredentials(new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_o.Key)), SecurityAlgorithms.HmacSha256);
        var jwt = new JwtSecurityToken(_o.Issuer, _o.Audience, claims, now, expires, creds);
        return new AccessToken(new JwtSecurityTokenHandler().WriteToken(jwt), jti, expires);
    }
}

/// <summary>Redis-backed token invalidation: individual tokens (by jti) and "everything issued before T" per user.</summary>
public sealed class TokenRevocationStore(IRedisService redis)
{
    private static string Jti(string jti) => $"revoked:jti:{jti}";
    private static string User(string userId) => $"revoked:user:{userId}";

    public Task RevokeTokenAsync(string jti, TimeSpan ttl) => redis.SetStringAsync(Jti(jti), "1", ttl);

    public Task RevokeAllForUserAsync(string userId, TimeSpan ttl) =>
        redis.SetStringAsync(User(userId), DateTimeOffset.UtcNow.ToUnixTimeSeconds().ToString(), ttl);

    /// <summary>True when this token (jti) was revoked, or was issued before the user's "revoke everything" timestamp.</summary>
    public async Task<bool> IsRevokedAsync(string? jti, string? userId, long issuedAtSeconds)
    {
        if (jti is not null && await redis.GetStringAsync(Jti(jti)) is not null) return true;
        if (userId is not null && await redis.GetStringAsync(User(userId)) is { } ts && long.TryParse(ts, out var t) && issuedAtSeconds < t) return true;
        return false;
    }
}
