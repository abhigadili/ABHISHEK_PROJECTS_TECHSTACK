using HMS.Records.Domain;
using HMS.Shared.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace HMS.Records.Data;

public class RecordsDbContext(DbContextOptions<RecordsDbContext> options) : ServiceDbContext(options)
{
    public DbSet<PatientRecord> PatientRecords => Set<PatientRecord>();
    public DbSet<RecordEntry> Entries => Set<RecordEntry>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        base.OnModelCreating(b);
        b.Entity<PatientRecord>(e =>
        {
            e.ToTable("hdn_patient_records");
            e.Property(x => x.PatientName).HasMaxLength(121).IsRequired();
            e.Property(x => x.ChronicConditions).HasMaxLength(500);
            e.HasIndex(x => x.PatientId).IsUnique().HasDatabaseName("uk_record_patient");
        });
        b.Entity<RecordEntry>(e =>
        {
            e.ToTable("hdn_record_entries");
            e.Property(x => x.EntryType).HasConversion<string>().HasMaxLength(15);
            e.Property(x => x.Title).HasMaxLength(200).IsRequired();
            e.Property(x => x.Details).HasMaxLength(4000);
            e.Property(x => x.ReferenceType).HasMaxLength(30);
            e.Property(x => x.Source).HasMaxLength(10);
            e.HasOne(x => x.Record).WithMany(r => r.Entries).HasForeignKey(x => x.RecordId).OnDelete(DeleteBehavior.Cascade).HasConstraintName("fk_hdn_entry_record");
            e.HasIndex(x => new { x.EntryType, x.ReferenceType, x.ReferenceId }).IsUnique().HasDatabaseName("uk_entry_reference");
            e.HasIndex(x => new { x.PatientId, x.RecordedAt }).HasDatabaseName("idx_entry_patient_time");
        });
    }
}

public class RecordsDbContextFactory : IDesignTimeDbContextFactory<RecordsDbContext>
{
    public RecordsDbContext CreateDbContext(string[] args)
    {
        var o = new DbContextOptionsBuilder<RecordsDbContext>();
        DbConnection.ConfigureDesignTime(o);
        return new RecordsDbContext(o.Options);
    }
}
