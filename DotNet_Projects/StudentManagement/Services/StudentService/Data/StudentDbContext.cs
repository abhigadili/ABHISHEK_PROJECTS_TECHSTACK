using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using StudentService.Entities;

namespace StudentService.Data;

/// <summary>StudentDB context: student profiles + Identity tables + refresh tokens. All table names are prefixed "dn_" so they can never collide with tables that already exist in the database.</summary>
public class StudentDbContext(DbContextOptions<StudentDbContext> options)
    : IdentityDbContext<AppUser, AppRole, long>(options)
{
    public DbSet<Student> Students => Set<Student>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();

    public override Task<int> SaveChangesAsync(CancellationToken ct = default)
    {
        var now = DateTime.UtcNow;
        foreach (var e in ChangeTracker.Entries())
        {
            if (e.Entity is Student st)
            {
                if (e.State == EntityState.Added) { st.CreatedAt = now; st.UpdatedAt = now; }
                else if (e.State == EntityState.Modified) st.UpdatedAt = now;
            }
            else if (e.Entity is AppUser u && e.State == EntityState.Added) u.CreatedAt = now;
            else if (e.Entity is RefreshToken t && e.State == EntityState.Added) t.CreatedAt = now;
        }
        return base.SaveChangesAsync(ct);
    }

    protected override void OnModelCreating(ModelBuilder b)
    {
        base.OnModelCreating(b);
        b.ApplyConfigurationsFromAssembly(typeof(StudentDbContext).Assembly);
        b.Entity<AppUser>().ToTable("dn_users");
        b.Entity<AppRole>().ToTable("dn_roles");
        b.Entity<IdentityUserRole<long>>().ToTable("dn_user_roles");
        b.Entity<IdentityUserClaim<long>>().ToTable("dn_user_claims");
        b.Entity<IdentityUserLogin<long>>().ToTable("dn_user_logins");
        b.Entity<IdentityRoleClaim<long>>().ToTable("dn_role_claims");
        b.Entity<IdentityUserToken<long>>().ToTable("dn_user_tokens");
    }
}
