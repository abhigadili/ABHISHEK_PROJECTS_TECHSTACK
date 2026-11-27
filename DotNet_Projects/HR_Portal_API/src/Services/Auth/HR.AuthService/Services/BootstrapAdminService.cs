using HR.AuthService.Data;
using HR.AuthService.Entities;
using Microsoft.EntityFrameworkCore;

namespace HR.AuthService.Services;

/// <summary>Creates (or re-syncs the password of) the bootstrap SUPER_ADMIN from environment configuration. Never overwrites a human-managed account.</summary>
public sealed class BootstrapAdminService(IServiceScopeFactory scopes, IConfiguration cfg, ILogger<BootstrapAdminService> log) : IHostedService
{
    public async Task StartAsync(CancellationToken ct)
    {
        var username = cfg["HR_BOOTSTRAP_ADMIN_USERNAME"]; var password = cfg["HR_BOOTSTRAP_ADMIN_PASSWORD"];
        if (string.IsNullOrWhiteSpace(username) || string.IsNullOrWhiteSpace(password)) return;
        for (var attempt = 1; attempt <= 6; attempt++)
        {
            try
            {
                using var scope = scopes.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<AuthDbContext>();
                var existing = await db.UserAccounts.FirstOrDefaultAsync(u => u.Username == username, ct);
                if (existing is not null)
                {
                    if (existing.CreatedBy == "system" && !BCrypt.Net.BCrypt.Verify(password, existing.PasswordHash))
                    {
                        existing.PasswordHash = BCrypt.Net.BCrypt.HashPassword(password, 10); existing.PasswordChangedAt = DateTime.UtcNow;
                        existing.FailedAttempts = 0; existing.LockedUntil = null; existing.Status = "ACTIVE";
                        await db.SaveChangesAsync(ct);
                        log.LogInformation("Bootstrap admin password re-synced from environment");
                    }
                    return;
                }
                var role = await db.Roles.FirstOrDefaultAsync(r => r.Name == "SUPER_ADMIN", ct) ?? throw new InvalidOperationException("Role SUPER_ADMIN is missing");
                var user = new UserAccount
                {
                    Username = username, Email = cfg["HR_BOOTSTRAP_ADMIN_EMAIL"] ?? $"{username}@hrportal.local", Status = "ACTIVE",
                    PasswordHash = BCrypt.Net.BCrypt.HashPassword(password, 10), PasswordChangedAt = DateTime.UtcNow
                };
                user.Roles.Add(role);
                db.UserAccounts.Add(user);
                await db.SaveChangesAsync(ct);
                log.LogInformation("Bootstrap super admin {Username} created", username);
                return;
            }
            catch (Exception ex) when (attempt < 6 && !ct.IsCancellationRequested) { log.LogWarning("Bootstrap admin attempt {Attempt} failed: {Error}", attempt, ex.Message); await Task.Delay(2000, ct); }
        }
    }

    public Task StopAsync(CancellationToken ct) => Task.CompletedTask;
}
