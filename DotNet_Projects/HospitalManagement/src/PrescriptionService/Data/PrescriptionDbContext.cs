using HMS.Prescriptions.Domain;
using HMS.Shared.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace HMS.Prescriptions.Data;

public class PrescriptionDbContext(DbContextOptions<PrescriptionDbContext> options) : ServiceDbContext(options)
{
    public DbSet<Prescription> Prescriptions => Set<Prescription>();
    public DbSet<PrescriptionItem> Items => Set<PrescriptionItem>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        base.OnModelCreating(b);
        b.Entity<Prescription>(e =>
        {
            e.ToTable("hdn_prescriptions");
            e.Property(x => x.PatientName).HasMaxLength(121).IsRequired();
            e.Property(x => x.PatientEmail).HasMaxLength(120);
            e.Property(x => x.DoctorName).HasMaxLength(125).IsRequired();
            e.Property(x => x.Diagnosis).HasMaxLength(500);
            e.Property(x => x.Notes).HasMaxLength(1000);
            e.Property(x => x.Status).HasConversion<string>().HasMaxLength(12);
            e.HasIndex(x => new { x.PatientId, x.IssuedAt }).HasDatabaseName("idx_rx_patient");
            e.HasIndex(x => new { x.Status, x.ValidUntil }).HasDatabaseName("idx_rx_status_valid");
        });
        b.Entity<PrescriptionItem>(e =>
        {
            e.ToTable("hdn_prescription_items");
            e.Property(x => x.MedicineName).HasMaxLength(150).IsRequired();
            e.Property(x => x.Dosage).HasMaxLength(60).IsRequired();
            e.Property(x => x.Frequency).HasMaxLength(80).IsRequired();
            e.Property(x => x.Instructions).HasMaxLength(255);
            e.HasOne(x => x.Prescription).WithMany(p => p.Items).HasForeignKey(x => x.PrescriptionId).OnDelete(DeleteBehavior.Cascade).HasConstraintName("fk_hdn_rx_item_prescription");
        });
    }
}

public class PrescriptionDbContextFactory : IDesignTimeDbContextFactory<PrescriptionDbContext>
{
    public PrescriptionDbContext CreateDbContext(string[] args)
    {
        var o = new DbContextOptionsBuilder<PrescriptionDbContext>();
        DbConnection.ConfigureDesignTime(o);
        return new PrescriptionDbContext(o.Options);
    }
}
