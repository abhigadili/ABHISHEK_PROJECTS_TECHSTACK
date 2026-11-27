using HMS.Appointments.Domain;
using HMS.Shared.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace HMS.Appointments.Data;

public class AppointmentDbContext(DbContextOptions<AppointmentDbContext> options) : ServiceDbContext(options)
{
    public DbSet<Appointment> Appointments => Set<Appointment>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        base.OnModelCreating(b);
        b.Entity<Appointment>(e =>
        {
            e.ToTable("hdn_appointments");
            e.Property(x => x.Status).HasConversion<string>().HasMaxLength(12);
            e.Property(x => x.PaymentStatus).HasConversion<string>().HasMaxLength(12);
            e.Property(x => x.SlotKey).HasMaxLength(80);
            e.Property(x => x.Reason).HasMaxLength(255);
            e.Property(x => x.CancelReason).HasMaxLength(255);
            e.Property(x => x.Notes).HasMaxLength(1000);
            e.Property(x => x.Fee).HasPrecision(10, 2);
            e.Property(x => x.BillNumber).HasMaxLength(40);
            e.Property(x => x.PatientName).HasMaxLength(121).IsRequired();
            e.Property(x => x.PatientEmail).HasMaxLength(120);
            e.Property(x => x.DoctorName).HasMaxLength(125).IsRequired();
            e.Property(x => x.DoctorEmail).HasMaxLength(120);
            e.Ignore(x => x.StartsAt);
            e.Ignore(x => x.EndsAt);
            e.HasIndex(x => x.SlotKey).IsUnique().HasDatabaseName("uk_appointment_slot");
            e.HasIndex(x => new { x.DoctorId, x.AppointmentDate, x.Status }).HasDatabaseName("idx_appt_doctor_date");
            e.HasIndex(x => new { x.PatientId, x.AppointmentDate }).HasDatabaseName("idx_appt_patient");
            e.HasIndex(x => new { x.Status, x.ReminderSent, x.AppointmentDate }).HasDatabaseName("idx_appt_reminder");
        });
    }
}

public class AppointmentDbContextFactory : IDesignTimeDbContextFactory<AppointmentDbContext>
{
    public AppointmentDbContext CreateDbContext(string[] args)
    {
        var o = new DbContextOptionsBuilder<AppointmentDbContext>();
        DbConnection.ConfigureDesignTime(o);
        return new AppointmentDbContext(o.Options);
    }
}
