using HMS.Hospitals.Data;
using HMS.Hospitals.Domain;
using HMS.Shared.Common;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace HMS.Hospitals.Services;

/// <summary>First-run bootstrap: the six roles, one user per role and the default hospital with six departments.</summary>
public static class DataSeeder
{
    public static async Task SeedAsync(IServiceProvider sp)
    {
        using var scope = sp.CreateScope();
        var log = scope.ServiceProvider.GetRequiredService<ILoggerFactory>().CreateLogger("Seeder");
        var cfg = scope.ServiceProvider.GetRequiredService<IConfiguration>();
        var roles = scope.ServiceProvider.GetRequiredService<RoleManager<IdentityRole<long>>>();
        var users = scope.ServiceProvider.GetRequiredService<UserManager<AppUser>>();
        var db = scope.ServiceProvider.GetRequiredService<HospitalDbContext>();

        foreach (var r in Roles.All)
            if (!await roles.RoleExistsAsync(r)) await roles.CreateAsync(new IdentityRole<long>(r));

        var admin = cfg["Seed:AdminPassword"] ?? "Admin@123";
        var staff = cfg["Seed:StaffPassword"] ?? "Staff@123";
        await Seed(users, log, "admin", "admin@hospital.local", admin, Roles.Admin);
        await Seed(users, log, "doctor1", "doctor1@hospital.local", staff, Roles.Doctor);
        await Seed(users, log, "doctor2", "doctor2@hospital.local", staff, Roles.Doctor);
        await Seed(users, log, "labstaff1", "labstaff1@hospital.local", staff, Roles.LabStaff);
        await Seed(users, log, "pharmacist1", "pharmacist1@hospital.local", staff, Roles.Pharmacist);
        await Seed(users, log, "billing1", "billing1@hospital.local", staff, Roles.BillingStaff);

        if (!await db.Hospitals.AnyAsync(h => h.Code == "CGH"))
        {
            var h = new Hospital { Name = "City General Hospital", Code = "CGH", City = "Hyderabad", Address = "1 Health Avenue", Phone = "+91-40-5550100", Email = "info@cgh.hospital.local" };
            foreach (var n in new[] { "Cardiology", "General Medicine", "Pediatrics", "Orthopedics", "Laboratory", "Pharmacy" }) h.Departments.Add(new Department { Name = n });
            db.Hospitals.Add(h);
            await db.SaveChangesAsync();
            log.LogInformation("Seeded default hospital CGH with 6 departments");
        }
    }

    private static async Task Seed(UserManager<AppUser> users, ILogger log, string name, string email, string password, string role)
    {
        if (await users.FindByNameAsync(name) is not null) return;
        var u = new AppUser { UserName = name, Email = email, EmailConfirmed = true };
        var res = await users.CreateAsync(u, password);
        if (!res.Succeeded) { log.LogError("Could not seed user {User}: {Errors}", name, string.Join("; ", res.Errors.Select(e => e.Description))); return; }
        await users.AddToRoleAsync(u, role);
        log.LogInformation("Seeded {Role} user {User}", role, name);
    }
}
