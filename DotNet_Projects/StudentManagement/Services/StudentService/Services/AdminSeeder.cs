using Common.Security;
using Microsoft.AspNetCore.Identity;
using StudentService.Entities;

namespace StudentService.Services;

/// <summary>Creates the three roles and the first Admin account (password from Bootstrap:AdminPassword / env Bootstrap__AdminPassword) when missing.</summary>
public class AdminSeeder(IServiceProvider sp, IConfiguration cfg, ILogger<AdminSeeder> log) : IHostedService
{
    public async Task StartAsync(CancellationToken ct)
    {
        using var scope = sp.CreateScope();
        var roles = scope.ServiceProvider.GetRequiredService<RoleManager<AppRole>>();
        foreach (var r in new[] { Roles.Admin, Roles.Staff, Roles.Student })
            if (!await roles.RoleExistsAsync(r)) await roles.CreateAsync(new AppRole(r));
        var users = scope.ServiceProvider.GetRequiredService<UserManager<AppUser>>();
        var name = cfg["Bootstrap:AdminUsername"] ?? "admin";
        if (await users.FindByNameAsync(name) != null) return;
        var pw = cfg["Bootstrap:AdminPassword"];
        if (string.IsNullOrWhiteSpace(pw)) { log.LogWarning("Bootstrap:AdminPassword not set; no admin account created"); return; }
        var admin = new AppUser { UserName = name, Email = cfg["Bootstrap:AdminEmail"] ?? "admin@sms.local" };
        var res = await users.CreateAsync(admin, pw);
        if (!res.Succeeded) { log.LogError("Admin seed failed: {Errors}", string.Join("; ", res.Errors.Select(e => e.Description))); return; }
        await users.AddToRoleAsync(admin, Roles.Admin);
        log.LogInformation("Bootstrapped Admin account '{Username}'", name);
    }

    public Task StopAsync(CancellationToken ct) => Task.CompletedTask;
}
