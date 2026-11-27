using HMS.Patients.Domain;
using HMS.Shared.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace HMS.Patients.Data;

public class PatientDbContext(DbContextOptions<PatientDbContext> options) : ServiceDbContext(options)
{
    public DbSet<Patient> Patients => Set<Patient>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        base.OnModelCreating(b);
        b.Entity<Patient>(e =>
        {
            e.ToTable("hdn_patients");
            e.HasKey(x => x.Id);
            e.Property(x => x.FirstName).HasMaxLength(60).IsRequired();
            e.Property(x => x.LastName).HasMaxLength(60).IsRequired();
            e.Property(x => x.Email).HasMaxLength(120).IsRequired();
            e.Property(x => x.Phone).HasMaxLength(20).IsRequired();
            e.Property(x => x.IdentityNumber).HasMaxLength(40);
            e.Property(x => x.BloodGroup).HasMaxLength(5);
            e.Property(x => x.Address).HasMaxLength(255);
            e.Property(x => x.EmergencyContactName).HasMaxLength(100);
            e.Property(x => x.EmergencyContactPhone).HasMaxLength(20);
            e.Property(x => x.KnownAllergies).HasMaxLength(500);
            e.Property(x => x.Gender).HasConversion<string>().HasMaxLength(10);
            e.Property(x => x.Status).HasConversion<string>().HasMaxLength(10);
            e.Ignore(x => x.FullName);
            e.HasIndex(x => x.UserId).IsUnique().HasDatabaseName("uk_patient_user");
            e.HasIndex(x => x.Email).IsUnique().HasDatabaseName("uk_patient_email");
            e.HasIndex(x => x.Phone).IsUnique().HasDatabaseName("uk_patient_phone");
            e.HasIndex(x => x.IdentityNumber).IsUnique().HasDatabaseName("uk_patient_identity");
            e.HasIndex(x => new { x.LastName, x.FirstName }).HasDatabaseName("idx_patient_name");
        });
    }
}

public class PatientDbContextFactory : IDesignTimeDbContextFactory<PatientDbContext>
{
    public PatientDbContext CreateDbContext(string[] args)
    {
        var o = new DbContextOptionsBuilder<PatientDbContext>();
        DbConnection.ConfigureDesignTime(o);
        return new PatientDbContext(o.Options);
    }
}
