using System.Security.Cryptography;
using System.Text;
using Common.Errors;
using Common.Security;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using StudentService.Data;
using StudentService.Dtos;
using StudentService.Entities;

namespace StudentService.Services;

public interface IAuthService
{
    Task<UserResponse> RegisterAsync(RegisterRequest r, bool callerIsAdmin, CancellationToken ct = default);
    Task<TokenResponse> LoginAsync(LoginRequest r, CancellationToken ct = default);
    Task<TokenResponse> RefreshAsync(string rawToken, CancellationToken ct = default);
    Task LogoutAsync(string rawToken, CancellationToken ct = default);
    Task<UserResponse> MeAsync(long userId);
}

/// <summary>
/// Authentication owner. Users, roles and refresh tokens live in StudentDB (tables dn_users, dn_roles, dn_user_roles, dn_refresh_tokens):
/// no fifth database is introduced. Passwords are hashed by ASP.NET Core Identity (PBKDF2 with per-user salt).
/// </summary>
public class AuthService(UserManager<AppUser> users, StudentDbContext db, IStudentAppService students, JwtTokenService jwt, ILogger<AuthService> log) : IAuthService
{
    public async Task<UserResponse> RegisterAsync(RegisterRequest r, bool callerIsAdmin, CancellationToken ct = default)
    {
        var role = string.IsNullOrWhiteSpace(r.Role) ? Roles.Student : Normalize(r.Role);
        if (role != Roles.Student && !callerIsAdmin) throw new ForbiddenException($"Only an Admin can create {role} accounts");
        if (await users.FindByNameAsync(r.Username) != null) throw new ConflictException("Username already taken");
        if (await users.FindByEmailAsync(r.Email) != null) throw new ConflictException("Email already registered");

        // EF's retrying execution strategy requires user transactions to run inside ExecuteAsync
        return await db.Database.CreateExecutionStrategy().ExecuteAsync(async () =>
        {
            db.ChangeTracker.Clear();
            await using var tx = await db.Database.BeginTransactionAsync(ct);   // student profile + login commit together
            long? studentId = null;
            if (role == Roles.Student)
            {
                if (string.IsNullOrWhiteSpace(r.FirstName) || string.IsNullOrWhiteSpace(r.LastName))
                    throw new ArgumentException("firstName and lastName are required for Student registration");
                var s = await students.CreateAsync(new StudentRequest(r.FirstName, r.LastName, r.Email, r.PhoneNumber, null, null, null, null, null), ct);
                studentId = s.StudentId;
            }
            var u = new AppUser { UserName = r.Username, Email = r.Email.Trim().ToLowerInvariant(), StudentId = studentId };
            var created = await users.CreateAsync(u, r.Password);
            if (!created.Succeeded) throw new ArgumentException(string.Join("; ", created.Errors.Select(e => e.Description)));
            await users.AddToRoleAsync(u, role);
            await tx.CommitAsync(ct);
            log.LogInformation("Registered user id={UserId} role={Role}", u.Id, role);

            return new UserResponse(u.Id, u.UserName!, u.Email!, role, studentId);
        });
    }

    public async Task<TokenResponse> LoginAsync(LoginRequest r, CancellationToken ct = default)
    {
        var u = await users.FindByNameAsync(r.Username) ?? await users.FindByEmailAsync(r.Username)
            ?? throw new UnauthorizedAppException("Invalid username or password");
        if (await users.IsLockedOutAsync(u)) throw new UnauthorizedAppException("Account temporarily locked after repeated failures");
        if (!await users.CheckPasswordAsync(u, r.Password))
        {
            await users.AccessFailedAsync(u);                    // 5 failures → 5 minute lockout (Identity options)
            log.LogWarning("Failed login for '{Username}'", r.Username);
            throw new UnauthorizedAppException("Invalid username or password");
        }
        await users.ResetAccessFailedCountAsync(u);
        return await IssueAsync(u, ct);
    }

    /// <summary>Rotation: the presented token is revoked and a new pair issued.</summary>
    public async Task<TokenResponse> RefreshAsync(string rawToken, CancellationToken ct = default)
    {
        var t = await db.RefreshTokens.FirstOrDefaultAsync(x => x.TokenHash == Hash(rawToken), ct) ?? throw new UnauthorizedAppException("Invalid refresh token");
        if (t.Revoked || t.ExpiresAt < DateTime.UtcNow) throw new UnauthorizedAppException("Refresh token expired or revoked");
        t.Revoked = true;
        var u = await users.FindByIdAsync(t.UserId.ToString()) ?? throw new UnauthorizedAppException("User no longer active");
        return await IssueAsync(u, ct);   // saves the revocation and the new token in one SaveChanges
    }

    public async Task LogoutAsync(string rawToken, CancellationToken ct = default)
    {
        var t = await db.RefreshTokens.FirstOrDefaultAsync(x => x.TokenHash == Hash(rawToken), ct);
        if (t is null) return;
        t.Revoked = true;
        await db.SaveChangesAsync(ct);
    }

    public async Task<UserResponse> MeAsync(long userId)
    {
        var u = await users.FindByIdAsync(userId.ToString()) ?? throw new UnauthorizedAppException("Unknown user");
        var role = (await users.GetRolesAsync(u)).FirstOrDefault() ?? "";
        return new UserResponse(u.Id, u.UserName!, u.Email!, role, u.StudentId);
    }

    private async Task<TokenResponse> IssueAsync(AppUser u, CancellationToken ct)
    {
        var roles = await users.GetRolesAsync(u);
        var access = jwt.CreateAccessToken(u.Id.ToString(), u.UserName!, roles, u.StudentId);
        var raw = Convert.ToBase64String(RandomNumberGenerator.GetBytes(48)).TrimEnd('=').Replace('+', '-').Replace('/', '_');
        db.RefreshTokens.Add(new RefreshToken { UserId = u.Id, TokenHash = Hash(raw), ExpiresAt = DateTime.UtcNow.Add(jwt.RefreshTtl) });
        await db.SaveChangesAsync(ct);
        return new TokenResponse(access, raw, "Bearer", (long)jwt.AccessTtl.TotalSeconds, u.UserName!, roles.FirstOrDefault() ?? "", u.StudentId);
    }

    public static string Hash(string raw) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(raw))).ToLowerInvariant();

    private static string Normalize(string role) => role.Trim().ToLowerInvariant() switch
    {
        "admin" => Roles.Admin, "staff" => Roles.Staff, "student" => Roles.Student,
        _ => throw new ArgumentException("Unknown role '" + role + "'. Allowed: Admin, Staff, Student")
    };
}
