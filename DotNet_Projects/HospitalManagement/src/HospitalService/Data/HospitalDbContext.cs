using HMS.Hospitals.Domain;
using HMS.Shared.Data;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace HMS.Hospitals.Data;

/// <summary>Hospital master data + ASP.NET Core Identity store (the platform's single identity authority). Tables carry the "hdn_" prefix.</summary>
public class HospitalDbContext(DbContextOptions<HospitalDbContext> options) : IdentityDbContext<AppUser, IdentityRole<long>, long>(options)
{
    public DbSet<Hospital> Hospitals => Set<Hospital>();
    public DbSet<Department> Departments => Set<Department>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        base.OnModelCreating(b);
        b.Entity<AppUser>().ToTable("hdn_users");
        b.Entity<IdentityRole<long>>().ToTable("hdn_roles");
        b.Entity<IdentityUserRole<long>>().ToTable("hdn_user_roles");
        b.Entity<IdentityUserClaim<long>>().ToTable("hdn_user_claims");
        b.Entity<IdentityUserLogin<long>>().ToTable("hdn_user_logins");
        b.Entity<IdentityUserToken<long>>().ToTable("hdn_user_tokens");
        b.Entity<IdentityRoleClaim<long>>().ToTable("hdn_role_claims");

        b.Entity<Hospital>(e =>
        {
            e.ToTable("hdn_hospitals");
            e.Property(x => x.Name).HasMaxLength(150).IsRequired();
            e.Property(x => x.Code).HasMaxLength(30).IsRequired();
            e.Property(x => x.Address).HasMaxLength(255);
            e.Property(x => x.City).HasMaxLength(80);
            e.Property(x => x.Phone).HasMaxLength(30);
            e.Property(x => x.Email).HasMaxLength(120);
            e.HasIndex(x => x.Code).IsUnique().HasDatabaseName("uk_hospital_code");
            e.HasIndex(x => x.City).HasDatabaseName("idx_hospital_city");
        });
        b.Entity<Department>(e =>
        {
            e.ToTable("hdn_departments");
            e.Property(x => x.Name).HasMaxLength(100).IsRequired();
            e.Property(x => x.Description).HasMaxLength(255);
            e.HasOne(x => x.Hospital).WithMany(h => h.Departments).HasForeignKey(x => x.HospitalId).OnDelete(DeleteBehavior.Restrict).HasConstraintName("fk_hdn_department_hospital");
            e.HasIndex(x => new { x.HospitalId, x.Name }).IsUnique().HasDatabaseName("uk_department_hospital_name");
        });
    }
}

public class HospitalDbContextFactory : IDesignTimeDbContextFactory<HospitalDbContext>
{
    public HospitalDbContext CreateDbContext(string[] args)
    {
        var o = new DbContextOptionsBuilder<HospitalDbContext>();
        DbConnection.ConfigureDesignTime(o);
        return new HospitalDbContext(o.Options);
    }
}
