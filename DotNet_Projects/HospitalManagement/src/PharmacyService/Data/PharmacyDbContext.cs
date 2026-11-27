using HMS.Pharmacy.Domain;
using HMS.Shared.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace HMS.Pharmacy.Data;

public class PharmacyDbContext(DbContextOptions<PharmacyDbContext> options) : ServiceDbContext(options)
{
    public DbSet<Medicine> Medicines => Set<Medicine>();
    public DbSet<PharmacyOrder> Orders => Set<PharmacyOrder>();
    public DbSet<PharmacyOrderItem> OrderItems => Set<PharmacyOrderItem>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        base.OnModelCreating(b);
        b.Entity<Medicine>(e =>
        {
            e.ToTable("hdn_medicines");
            e.Property(x => x.Sku).HasMaxLength(40).IsRequired();
            e.Property(x => x.Name).HasMaxLength(150).IsRequired();
            e.Property(x => x.GenericName).HasMaxLength(150);
            e.Property(x => x.UnitPrice).HasPrecision(10, 2);
            e.HasIndex(x => x.Sku).IsUnique().HasDatabaseName("uk_medicine_sku");
            e.HasIndex(x => x.Name).HasDatabaseName("idx_medicine_name");
            e.HasIndex(x => x.GenericName).HasDatabaseName("idx_medicine_generic");
        });
        b.Entity<PharmacyOrder>(e =>
        {
            e.ToTable("hdn_pharmacy_orders");
            e.Property(x => x.PatientName).HasMaxLength(121).IsRequired();
            e.Property(x => x.PatientEmail).HasMaxLength(120);
            e.Property(x => x.DoctorName).HasMaxLength(125);
            e.Property(x => x.Status).HasConversion<string>().HasMaxLength(10);
            e.Property(x => x.TotalAmount).HasPrecision(12, 2);
            e.Property(x => x.DispensedBy).HasMaxLength(60);
            e.Property(x => x.RejectionReason).HasMaxLength(255);
            e.HasIndex(x => x.PrescriptionId).IsUnique().HasDatabaseName("uk_order_prescription");
            e.HasIndex(x => new { x.Status, x.CreatedAt }).HasDatabaseName("idx_order_status");
        });
        b.Entity<PharmacyOrderItem>(e =>
        {
            e.ToTable("hdn_pharmacy_order_items");
            e.Property(x => x.MedicineName).HasMaxLength(150).IsRequired();
            e.Property(x => x.Dosage).HasMaxLength(60);
            e.Property(x => x.UnitPrice).HasPrecision(10, 2);
            e.HasOne(x => x.Order).WithMany(o => o.Items).HasForeignKey(x => x.OrderId).OnDelete(DeleteBehavior.Cascade).HasConstraintName("fk_hdn_order_item_order");
            e.HasOne(x => x.Medicine).WithMany().HasForeignKey(x => x.MedicineId).OnDelete(DeleteBehavior.SetNull).HasConstraintName("fk_hdn_order_item_medicine");
        });
    }
}

public class PharmacyDbContextFactory : IDesignTimeDbContextFactory<PharmacyDbContext>
{
    public PharmacyDbContext CreateDbContext(string[] args)
    {
        var o = new DbContextOptionsBuilder<PharmacyDbContext>();
        DbConnection.ConfigureDesignTime(o);
        return new PharmacyDbContext(o.Options);
    }
}
