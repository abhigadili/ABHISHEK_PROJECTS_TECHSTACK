using HMS.Billing.Domain;
using HMS.Shared.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace HMS.Billing.Data;

public class BillingDbContext(DbContextOptions<BillingDbContext> options) : ServiceDbContext(options)
{
    public DbSet<Bill> Bills => Set<Bill>();
    public DbSet<BillItem> BillItems => Set<BillItem>();
    public DbSet<Payment> Payments => Set<Payment>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        base.OnModelCreating(b);
        b.Entity<Bill>(e =>
        {
            e.ToTable("hdn_bills");
            e.Property(x => x.BillNumber).HasMaxLength(40).IsRequired();
            e.Property(x => x.PatientName).HasMaxLength(121).IsRequired();
            e.Property(x => x.PatientEmail).HasMaxLength(120);
            e.Property(x => x.BillType).HasConversion<string>().HasMaxLength(12);
            e.Property(x => x.ReferenceType).HasMaxLength(20);
            e.Property(x => x.Status).HasConversion<string>().HasMaxLength(12);
            e.Property(x => x.TotalAmount).HasPrecision(12, 2);
            e.Property(x => x.PaidAmount).HasPrecision(12, 2);
            e.Property(x => x.Currency).HasMaxLength(3);
            e.Property(x => x.Note).HasMaxLength(255);
            e.Ignore(x => x.Outstanding);
            e.HasIndex(x => x.BillNumber).IsUnique().HasDatabaseName("uk_bill_number");
            e.HasIndex(x => new { x.ReferenceType, x.ReferenceId }).IsUnique().HasDatabaseName("uk_bill_reference");
            e.HasIndex(x => new { x.PatientId, x.CreatedAt }).HasDatabaseName("idx_bill_patient");
            e.HasIndex(x => new { x.Status, x.DueDate }).HasDatabaseName("idx_bill_status_due");
        });
        b.Entity<BillItem>(e =>
        {
            e.ToTable("hdn_bill_items");
            e.Property(x => x.Description).HasMaxLength(200).IsRequired();
            e.Property(x => x.UnitPrice).HasPrecision(12, 2);
            e.Property(x => x.Amount).HasPrecision(12, 2);
            e.HasOne(x => x.Bill).WithMany(x => x.Items).HasForeignKey(x => x.BillId).OnDelete(DeleteBehavior.Cascade).HasConstraintName("fk_hdn_bill_item_bill");
        });
        b.Entity<Payment>(e =>
        {
            e.ToTable("hdn_payments");
            e.Property(x => x.TransactionRef).HasMaxLength(40).IsRequired();
            e.Property(x => x.Amount).HasPrecision(12, 2);
            e.Property(x => x.Method).HasConversion<string>().HasMaxLength(15);
            e.Property(x => x.Status).HasConversion<string>().HasMaxLength(10);
            e.Property(x => x.FailureReason).HasMaxLength(255);
            e.HasOne(x => x.Bill).WithMany(x => x.Payments).HasForeignKey(x => x.BillId).OnDelete(DeleteBehavior.Cascade).HasConstraintName("fk_hdn_payment_bill");
            e.HasIndex(x => x.TransactionRef).IsUnique().HasDatabaseName("uk_payment_txn");
            e.HasIndex(x => x.ActiveBillId).IsUnique().HasDatabaseName("uk_payment_one_pending_per_bill");
            e.HasIndex(x => new { x.Status, x.InitiatedAt }).HasDatabaseName("idx_payment_status");
        });
    }
}

public class BillingDbContextFactory : IDesignTimeDbContextFactory<BillingDbContext>
{
    public BillingDbContext CreateDbContext(string[] args)
    {
        var o = new DbContextOptionsBuilder<BillingDbContext>();
        DbConnection.ConfigureDesignTime(o);
        return new BillingDbContext(o.Options);
    }
}
