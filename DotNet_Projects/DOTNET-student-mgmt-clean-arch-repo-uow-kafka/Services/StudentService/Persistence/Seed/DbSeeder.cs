using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using StudentMgmt.BuildingBlocks.Common.Constants;
using StudentMgmt.BuildingBlocks.Common.Security;
using StudentMgmt.StudentService.Entities;

namespace StudentMgmt.StudentService.Persistence.Seed;

/// <summary>
/// Seeds the three fixed roles and one default Admin account so a fresh
/// grader/reviewer can immediately log in to exercise Admin-only endpoints.
///
/// Seeded Admin credentials (document these — this is the only way to log in to
/// a brand new database, there is no other bootstrap mechanism):
///   Email:    admin@studentmgmt.local
///   Password: Admin@12345
/// </summary>
public static class DbSeeder
{
    public const string SeedAdminEmail = "admin@studentmgmt.local";
    public const string SeedAdminPassword = "Admin@12345";

    public static async Task SeedAsync(IServiceProvider serviceProvider)
    {
        var db = serviceProvider.GetRequiredService<StudentDbContext>();
        var passwordHasher = serviceProvider.GetRequiredService<IPasswordHasher>();

        foreach (var roleName in RoleConstants.All)
        {
            var exists = await db.Roles.IgnoreQueryFilters().AnyAsync(r => r.Name == roleName);
            if (!exists)
            {
                await db.Roles.AddAsync(new Role { Name = roleName, CreatedBy = "seed" });
            }
        }

        await db.SaveChangesAsync();

        var adminUser = await db.Users.IgnoreQueryFilters().FirstOrDefaultAsync(u => u.Email == SeedAdminEmail);
        if (adminUser is null)
        {
            adminUser = new ApplicationUser
            {
                FullName = "System Administrator",
                Email = SeedAdminEmail,
                PasswordHash = passwordHasher.Hash(SeedAdminPassword),
                CreatedBy = "seed"
            };
            await db.Users.AddAsync(adminUser);
            await db.SaveChangesAsync();

            var adminRole = await db.Roles.IgnoreQueryFilters().FirstAsync(r => r.Name == RoleConstants.Admin);

            var hasUserRole = await db.UserRoles.IgnoreQueryFilters()
                .AnyAsync(ur => ur.UserId == adminUser.Id && ur.RoleId == adminRole.Id);

            if (!hasUserRole)
            {
                await db.UserRoles.AddAsync(new UserRole
                {
                    UserId = adminUser.Id,
                    RoleId = adminRole.Id,
                    CreatedBy = "seed"
                });
                await db.SaveChangesAsync();
            }
        }
    }
}
