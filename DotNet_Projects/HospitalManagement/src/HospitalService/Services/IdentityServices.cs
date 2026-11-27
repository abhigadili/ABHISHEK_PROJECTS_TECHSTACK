using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using HMS.Hospitals.Domain;
using HMS.Hospitals.Dtos;
using HMS.Shared.Common;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

namespace HMS.Hospitals.Services;

/// <summary>Issues the HS256 access tokens that the gateway and every service validate.</summary>
public sealed class TokenService(IConfiguration cfg)
{
    private readonly SymmetricSecurityKey _key = new(Encoding.UTF8.GetBytes(cfg["Jwt:Key"]!));
    public TimeSpan Lifetime { get; } = TimeSpan.FromMinutes(cfg.GetValue("Jwt:ExpiryMinutes", 120));

    public string Issue(AppUser user, IList<string> roles)
    {
        var now = DateTime.UtcNow;
        var claims = new List<Claim>
        {
            new("sub", user.Id.ToString()),
            new("unique_name", user.UserName!),
            new("email", user.Email!),
            new("jti", Guid.NewGuid().ToString("N"))
        };
        claims.AddRange(roles.Select(r => new Claim("role", r)));
        var token = new JwtSecurityToken(cfg["Jwt:Issuer"] ?? "hospital-identity", cfg["Jwt:Audience"] ?? "hospital-api", claims, now, now.Add(Lifetime),
            new SigningCredentials(_key, SecurityAlgorithms.HmacSha256));
        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}

public interface IAuthService
{
    Task<TokenResponse> LoginAsync(LoginRequest r);
    Task<UserResponse> RegisterPatientAsync(RegisterRequest r);
    Task<UserResponse> CreateUserAsync(CreateUserRequest r);
    Task<UserResponse> MeAsync();
    Task<List<UserResponse>> ListAsync(CancellationToken ct);
    Task<UserResponse> SetEnabledAsync(long id, bool enabled);
}

public sealed class AuthService(UserManager<AppUser> users, TokenService tokens, ICurrentUser current, ILogger<AuthService> log) : IAuthService
{
    public async Task<TokenResponse> LoginAsync(LoginRequest r)
    {
        var u = await users.FindByNameAsync(r.Username);
        // identical answer for unknown user / wrong password / disabled / locked account: no user enumeration
        if (u is null || !u.IsEnabled || await users.IsLockedOutAsync(u) || !await users.CheckPasswordAsync(u, r.Password))
        {
            if (u is not null && u.IsEnabled) await users.AccessFailedAsync(u);
            log.LogWarning("Failed login attempt for username {Username}", r.Username);
            throw new UnauthorizedException("Invalid username or password");
        }
        await users.ResetAccessFailedCountAsync(u);
        u.LastLoginAt = DateTime.UtcNow;
        await users.UpdateAsync(u);
        var roles = await users.GetRolesAsync(u);
        log.LogInformation("User {Username} logged in with role {Role}", u.UserName, roles.FirstOrDefault());
        return new TokenResponse(tokens.Issue(u, roles), "Bearer", (long)tokens.Lifetime.TotalSeconds, ToResponse(u, roles));
    }

    public Task<UserResponse> RegisterPatientAsync(RegisterRequest r) => CreateAsync(r.Username, r.Email, r.Password, Roles.Patient);

    public Task<UserResponse> CreateUserAsync(CreateUserRequest r)
    {
        if (!Roles.All.Contains(r.Role)) throw new BadRequestException($"Unknown role '{r.Role}'. Allowed: {string.Join(", ", Roles.All)}");
        return CreateAsync(r.Username, r.Email, r.Password, r.Role);
    }

    private async Task<UserResponse> CreateAsync(string username, string email, string password, string role)
    {
        if (await users.FindByNameAsync(username) is not null) throw new ConflictException($"Username '{username}' is already taken");
        if (await users.FindByEmailAsync(email) is not null) throw new ConflictException($"Email '{email}' is already registered");
        var u = new AppUser { UserName = username, Email = email.ToLowerInvariant(), EmailConfirmed = true };
        var result = await users.CreateAsync(u, password);   // ASP.NET Core Identity hashes the password (PBKDF2)
        if (!result.Succeeded) throw new BadRequestException(string.Join("; ", result.Errors.Select(e => e.Description)));
        await users.AddToRoleAsync(u, role);
        log.LogInformation("Created user {Username} with role {Role}", username, role);
        return ToResponse(u, [role]);
    }

    public async Task<UserResponse> MeAsync()
    {
        var u = await users.FindByIdAsync((current.Id ?? -1).ToString()) ?? throw new NotFoundException("User not found");
        return ToResponse(u, await users.GetRolesAsync(u));
    }

    public async Task<List<UserResponse>> ListAsync(CancellationToken ct)
    {
        var list = await users.Users.AsNoTracking().OrderBy(u => u.Id).ToListAsync(ct);
        var result = new List<UserResponse>();
        foreach (var u in list) result.Add(ToResponse(u, await users.GetRolesAsync(u)));
        return result;
    }

    public async Task<UserResponse> SetEnabledAsync(long id, bool enabled)
    {
        var u = await users.FindByIdAsync(id.ToString()) ?? throw new NotFoundException($"User {id} not found");
        if (!enabled && id == current.Id) throw new BadRequestException("You cannot disable your own account");
        u.IsEnabled = enabled;
        await users.UpdateAsync(u);
        return ToResponse(u, await users.GetRolesAsync(u));
    }

    private static UserResponse ToResponse(AppUser u, IList<string> roles) => new(u.Id, u.UserName!, u.Email!, roles.FirstOrDefault() ?? "", u.IsEnabled);
}
