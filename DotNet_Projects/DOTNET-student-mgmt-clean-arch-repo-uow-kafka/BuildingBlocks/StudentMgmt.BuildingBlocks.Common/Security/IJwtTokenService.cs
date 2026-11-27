using System.Security.Claims;

namespace StudentMgmt.BuildingBlocks.Common.Security;

public record GeneratedToken(string AccessToken, DateTime AccessTokenExpiresAtUtc, string RefreshToken, DateTime RefreshTokenExpiresAtUtc);

/// <summary>
/// Only StudentService's AuthController calls <see cref="GenerateToken"/> (it is
/// the identity owner for this system); every service (including StudentService
/// itself) uses the Microsoft.AspNetCore.Authentication.JwtBearer handler
/// (registered via <see cref="ServiceCollectionExtensions.AddJwtAuthentication"/>)
/// to validate incoming tokens against the same <see cref="JwtSettings"/>.
/// </summary>
public interface IJwtTokenService
{
    GeneratedToken GenerateToken(Guid userId, string email, string fullName, IReadOnlyCollection<string> roles);

    string GenerateRefreshTokenValue();

    /// <summary>Extracts claims from an expired access token so a refresh-token
    /// exchange can identify who is asking without requiring a still-valid token.</summary>
    ClaimsPrincipal? GetPrincipalFromExpiredToken(string token);
}
