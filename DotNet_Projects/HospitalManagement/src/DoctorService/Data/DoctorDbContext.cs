using HMS.Doctors.Domain;
using HMS.Shared.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace HMS.Doctors.Data;

public class DoctorDbContext(DbContextOptions<DoctorDbContext> options) : DbContext(options)
{
    public DbSet<Doctor> Doctors => Set<Doctor>();
    public DbSet<DoctorSchedule> Schedules => Set<DoctorSchedule>();
    public DbSet<DoctorUnavailability> Unavailability => Set<DoctorUnavailability>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<Doctor>(e =>
        {
            e.ToTable("hdn_doctors");
            e.Property(x => x.FirstName).HasMaxLength(60).IsRequired();
            e.Property(x => x.LastName).HasMaxLength(60).IsRequired();
            e.Property(x => x.Email).HasMaxLength(120).IsRequired();
            e.Property(x => x.Phone).HasMaxLength(20);
            e.Property(x => x.LicenseNumber).HasMaxLength(40).IsRequired();
            e.Property(x => x.Specialization).HasMaxLength(80).IsRequired();
            e.Property(x => x.Qualification).HasMaxLength(150);
            e.Property(x => x.ConsultationFee).HasPrecision(10, 2);
            e.Ignore(x => x.FullName);
            e.HasIndex(x => x.LicenseNumber).IsUnique().HasDatabaseName("uk_doctor_license");
            e.HasIndex(x => x.Email).IsUnique().HasDatabaseName("uk_doctor_email");
            e.HasIndex(x => x.UserId).IsUnique().HasDatabaseName("uk_doctor_user");
            e.HasIndex(x => new { x.Specialization, x.Active }).HasDatabaseName("idx_doctor_specialization");
            e.HasIndex(x => new { x.HospitalId, x.DepartmentId }).HasDatabaseName("idx_doctor_hospital");
        });
        b.Entity<DoctorSchedule>(e =>
        {
            e.ToTable("hdn_doctor_schedules");
            e.Property(x => x.DayOfWeek).HasConversion<string>().HasMaxLength(10);
            e.HasOne(x => x.Doctor).WithMany(d => d.Schedules).HasForeignKey(x => x.DoctorId).OnDelete(DeleteBehavior.Cascade).HasConstraintName("fk_hdn_schedule_doctor");
            e.HasIndex(x => new { x.DoctorId, x.DayOfWeek }).IsUnique().HasDatabaseName("uk_schedule_doctor_day");
        });
        b.Entity<DoctorUnavailability>(e =>
        {
            e.ToTable("hdn_doctor_unavailability");
            e.Property(x => x.Reason).HasMaxLength(200);
            e.HasOne(x => x.Doctor).WithMany(d => d.Unavailability).HasForeignKey(x => x.DoctorId).OnDelete(DeleteBehavior.Cascade).HasConstraintName("fk_hdn_unavailable_doctor");
            e.HasIndex(x => new { x.DoctorId, x.UnavailableDate }).IsUnique().HasDatabaseName("uk_unavailable_doctor_date");
        });
    }
}

public class DoctorDbContextFactory : IDesignTimeDbContextFactory<DoctorDbContext>
{
    public DoctorDbContext CreateDbContext(string[] args)
    {
        var o = new DbContextOptionsBuilder<DoctorDbContext>();
        DbConnection.ConfigureDesignTime(o);
        return new DoctorDbContext(o.Options);
    }
}
