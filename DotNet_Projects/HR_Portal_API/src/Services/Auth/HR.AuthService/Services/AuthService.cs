using System.Security.Cryptography;
using System.Text;
using HR.AuthService.Data;
using HR.AuthService.DTOs;
using HR.AuthService.Entities;
using HR.Common.Cache;
using HR.Common.Common;
using HR.Common.Data;
using HR.Common.Messaging;
using HR.Common.Security;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace HR.AuthService.Services;

public interface IAuthService
{
    Task<TokenResponse> LoginAsync(LoginRequest req, string? ip, CancellationToken ct);
    Task<TokenResponse> RefreshAsync(string refreshToken, string? ip, CancellationToken ct);
    Task LogoutAsync(string? refreshToken, CancellationToken ct);
    Task<UserDto> MeAsync(CancellationToken ct);
    Task ChangePasswordAsync(ChangePasswordRequest req, CancellationToken ct);
    Task ForgotPasswordAsync(string email, CancellationToken ct);
    Task ResetPasswordAsync(string token, string newPassword, CancellationToken ct);
    Task InvalidateSessionsAsync(string userId, CancellationToken ct);
}

public sealed class AuthService(AuthDbContext db, JwtTokenIssuer issuer, TokenRevocationStore revocation, IRedisService redis, IOptions<JwtOptions> jwt, IConfiguration cfg,
    ICurrentUser current, IEventPublisher events, IAuditWriter audit, IUnitOfWork uow, ILogger<AuthService> log) : IAuthService
{
    // dummy hash so an unknown username costs the same as a wrong password (no user enumeration through timing)
    private static readonly string DummyHash = BCrypt.Net.BCrypt.HashPassword("not-a-real-password", 10);
    private int MaxFailed => cfg.GetValue("Auth:MaxFailedAttempts", 5);
    private int LockMinutes => cfg.GetValue("Auth:LockMinutes", 15);
    private int ResetMinutes => cfg.GetValue("Auth:ResetTokenMinutes", 30);

    public async Task<TokenResponse> LoginAsync(LoginRequest req, string? ip, CancellationToken ct)
    {
        var name = req.Username.Trim();
        var user = await db.UserAccounts.Include(u => u.Roles).ThenInclude(r => r.Permissions)
            .FirstOrDefaultAsync(u => u.Username == name || u.Email == name, ct);
        if (user is null) { BCrypt.Net.BCrypt.Verify(req.Password, DummyHash); throw new UnauthorizedException("Invalid username or password"); }
        if (user.Status == "INACTIVE") throw new ForbiddenException("Account is deactivated");
        if (user.LockedUntil is { } until && until > DateTime.UtcNow)
            throw new HrException(System.Net.HttpStatusCode.Locked, "ACCOUNT_LOCKED", "Account is temporarily locked due to repeated failed logins");

        if (!BCrypt.Net.BCrypt.Verify(req.Password, user.PasswordHash))
        {
            user.FailedAttempts++;
            var lockNow = user.FailedAttempts >= MaxFailed;
            if (lockNow) { user.LockedUntil = DateTime.UtcNow.AddMinutes(LockMinutes); user.FailedAttempts = 0; }
            await db.SaveChangesAsync(ct);
            await redis.IncrementAsync($"auth:failed:{user.Id}", TimeSpan.FromMinutes(15));
            log.LogWarning("Failed login for user {UserId} (attempt counter {Attempts})", user.Id, user.FailedAttempts);
            if (lockNow) throw new HrException(System.Net.HttpStatusCode.Locked, "ACCOUNT_LOCKED", $"Account locked for {LockMinutes} minutes");
            throw new UnauthorizedException("Invalid username or password");
        }
        user.FailedAttempts = 0; user.LockedUntil = null; user.LastLoginAt = DateTime.UtcNow;
        if (user.Status == "LOCKED") user.Status = "ACTIVE";
        await db.SaveChangesAsync(ct);
        return await IssueAsync(user, ip, ct);
    }

    /// <summary>Refresh-token rotation: the presented token is revoked and a new pair is issued.</summary>
    public async Task<TokenResponse> RefreshAsync(string refreshToken, string? ip, CancellationToken ct)
    {
        var hash = Sha256(refreshToken);
        var row = await db.RefreshTokens.FirstOrDefaultAsync(r => r.TokenHash == hash && r.RevokedAt == null && r.ExpiresAt > DateTime.UtcNow, ct)
                  ?? throw new UnauthorizedException("Invalid refresh token");
        var user = await db.UserAccounts.Include(u => u.Roles).ThenInclude(r => r.Permissions).FirstOrDefaultAsync(u => u.Id == row.UserId, ct);
        if (user is null || user.Status != "ACTIVE") throw new UnauthorizedException("Account is not active");
        row.RevokedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
        await redis.DeleteAsync($"auth:refresh:{hash}");
        if (row.AccessTokenId is not null) await revocation.RevokeTokenAsync(row.AccessTokenId, TimeSpan.FromSeconds(jwt.Value.AccessTtlSeconds));
        return await IssueAsync(user, ip, ct);
    }

    public async Task LogoutAsync(string? refreshToken, CancellationToken ct)
    {
        var jti = current.IsAuthenticated ? (await Task.FromResult(current.Token is null ? null : new System.IdentityModel.Tokens.Jwt.JwtSecurityTokenHandler().ReadJwtToken(current.Token).Id)) : null;
        if (jti is not null) await revocation.RevokeTokenAsync(jti, TimeSpan.FromSeconds(jwt.Value.AccessTtlSeconds));
        if (!string.IsNullOrEmpty(refreshToken))
        {
            var hash = Sha256(refreshToken);
            var row = await db.RefreshTokens.FirstOrDefaultAsync(r => r.TokenHash == hash && r.RevokedAt == null, ct);
            if (row is not null && row.UserId == current.UserId) { row.RevokedAt = DateTime.UtcNow; await db.SaveChangesAsync(ct); }
            await redis.DeleteAsync($"auth:refresh:{hash}");
        }
    }

    public async Task<UserDto> MeAsync(CancellationToken ct)
    {
        var id = current.UserId ?? throw new UnauthorizedException();
        var user = await db.UserAccounts.AsNoTracking().Include(u => u.Roles).ThenInclude(r => r.Permissions).FirstOrDefaultAsync(u => u.Id == id, ct)
                   ?? throw new NotFoundException("User not found");
        return UserService.ToDto(user);
    }

    public async Task ChangePasswordAsync(ChangePasswordRequest req, CancellationToken ct)
    {
        var id = current.UserId ?? throw new UnauthorizedException();
        var user = await db.UserAccounts.FirstOrDefaultAsync(u => u.Id == id, ct) ?? throw new NotFoundException("User not found");
        if (!BCrypt.Net.BCrypt.Verify(req.CurrentPassword, user.PasswordHash)) throw new Common.Common.ValidationException("Current password is incorrect");
        await uow.ExecuteAsync(async () =>
        {
            ApplyPassword(user, req.NewPassword, false);
            await db.SaveChangesAsync(ct);
            await audit.WriteAsync("UserAccount", user.Id, "PASSWORD_CHANGED");
        }, ct);
        await InvalidateSessionsAsync(user.Id, ct);
    }

    public async Task InvalidateSessionsAsync(string userId, CancellationToken ct)
    {
        await db.RefreshTokens.Where(r => r.UserId == userId && r.RevokedAt == null).ExecuteUpdateAsync(s => s.SetProperty(r => r.RevokedAt, DateTime.UtcNow), ct);
        await revocation.RevokeAllForUserAsync(userId, TimeSpan.FromSeconds(jwt.Value.AccessTtlSeconds + 60));
    }

    /// <summary>Always answers the same way (no account enumeration); the one-time token (stored only as a hash) is delivered through the notification pipeline.</summary>
    public async Task ForgotPasswordAsync(string email, CancellationToken ct)
    {
        var user = await db.UserAccounts.FirstOrDefaultAsync(u => u.Email == email, ct);
        if (user is null || user.Status == "INACTIVE") return;
        var token = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32)).Replace('+', '-').Replace('/', '_').TrimEnd('=');
        await uow.ExecuteAsync(async () =>
        {
            db.PasswordResetTokens.Add(new PasswordResetToken { UserId = user.Id, TokenHash = Sha256(token), ExpiresAt = DateTime.UtcNow.AddMinutes(ResetMinutes) });
            events.Publish(Topics.NotificationRequested, user.EmployeeId ?? user.Id, new NotificationRequestedEvent(user.EmployeeId, user.Email, "PASSWORD_RESET", "EMAIL",
                "Reset your HR Portal password", $"Use this one-time token within {ResetMinutes} minutes: {token}", null, "UserAccount", user.Id, $"pwreset:{user.Id}"));
            await db.SaveChangesAsync(ct);
        }, ct);
    }

    public async Task ResetPasswordAsync(string token, string newPassword, CancellationToken ct)
    {
        var hash = Sha256(token);
        var row = await db.PasswordResetTokens.FirstOrDefaultAsync(t => t.TokenHash == hash && t.UsedAt == null && t.ExpiresAt > DateTime.UtcNow, ct)
                  ?? throw new Common.Common.ValidationException("Reset token is invalid or has expired");
        var user = await db.UserAccounts.FirstAsync(u => u.Id == row.UserId, ct);
        await uow.ExecuteAsync(async () =>
        {
            ApplyPassword(user, newPassword, false);
            row.UsedAt = DateTime.UtcNow;
            await db.SaveChangesAsync(ct);
            await audit.WriteAsync("UserAccount", user.Id, "PASSWORD_RESET");
        }, ct);
        await InvalidateSessionsAsync(user.Id, ct);
    }

    internal static void ApplyPassword(UserAccount user, string password, bool mustChange)
    {
        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(password, 10);
        user.PasswordChangedAt = DateTime.UtcNow; user.MustChangePassword = mustChange; user.FailedAttempts = 0; user.LockedUntil = null;
    }

    private async Task<TokenResponse> IssueAsync(UserAccount user, string? ip, CancellationToken ct)
    {
        var roles = user.Roles.Select(r => r.Name).ToList();
        var perms = user.Roles.SelectMany(r => r.Permissions).Select(p => p.Code).Distinct().OrderBy(p => p).ToList();
        var access = issuer.Issue(user.Id, user.Username, user.Email, user.EmployeeId, roles, perms);
        var refresh = Convert.ToBase64String(RandomNumberGenerator.GetBytes(48)).Replace('+', '-').Replace('/', '_').TrimEnd('=');
        var hash = Sha256(refresh);
        db.RefreshTokens.Add(new RefreshToken { UserId = user.Id, TokenHash = hash, AccessTokenId = access.Jti, ExpiresAt = DateTime.UtcNow.AddSeconds(jwt.Value.RefreshTtlSeconds), IpAddress = ip });
        await db.SaveChangesAsync(ct);
        await redis.SetStringAsync($"auth:refresh:{hash}", user.Id, TimeSpan.FromSeconds(jwt.Value.RefreshTtlSeconds));
        return new TokenResponse(access.Token, "Bearer", jwt.Value.AccessTtlSeconds, refresh, user.MustChangePassword,
            new AuthUserInfo(user.Id, user.Username, user.Email, user.EmployeeId, roles, perms));
    }

    internal static string Sha256(string s) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(s))).ToLowerInvariant();
}
