using HMS.Laboratory.Domain;
using HMS.Shared.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace HMS.Laboratory.Data;

public class LaboratoryDbContext(DbContextOptions<LaboratoryDbContext> options) : ServiceDbContext(options)
{
    public DbSet<LabTest> Tests => Set<LabTest>();
    public DbSet<LabRequest> Requests => Set<LabRequest>();
    public DbSet<LabReport> Reports => Set<LabReport>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        base.OnModelCreating(b);
        b.Entity<LabTest>(e =>
        {
            e.ToTable("hdn_lab_tests");
            e.Property(x => x.Code).HasMaxLength(30).IsRequired();
            e.Property(x => x.Name).HasMaxLength(150).IsRequired();
            e.Property(x => x.SampleType).HasMaxLength(60);
            e.Property(x => x.Price).HasPrecision(10, 2);
            e.HasIndex(x => x.Code).IsUnique().HasDatabaseName("uk_lab_test_code");
        });
        b.Entity<LabRequest>(e =>
        {
            e.ToTable("hdn_lab_requests");
            e.Property(x => x.PatientName).HasMaxLength(121).IsRequired();
            e.Property(x => x.PatientEmail).HasMaxLength(120);
            e.Property(x => x.TestName).HasMaxLength(150).IsRequired();
            e.Property(x => x.Price).HasPrecision(10, 2);
            e.Property(x => x.Priority).HasConversion<string>().HasMaxLength(10);
            e.Property(x => x.Status).HasConversion<string>().HasMaxLength(20);
            e.Property(x => x.ClinicalNotes).HasMaxLength(500);
            e.Property(x => x.AccessionNumber).HasMaxLength(40);
            e.HasOne(x => x.Test).WithMany().HasForeignKey(x => x.TestId).OnDelete(DeleteBehavior.Restrict).HasConstraintName("fk_hdn_lab_request_test");
            e.HasIndex(x => x.AccessionNumber).IsUnique().HasDatabaseName("uk_lab_accession");
            e.HasIndex(x => new { x.PatientId, x.RequestedAt }).HasDatabaseName("idx_lab_patient");
            e.HasIndex(x => new { x.Status, x.Priority }).HasDatabaseName("idx_lab_status");
        });
        b.Entity<LabReport>(e =>
        {
            e.ToTable("hdn_lab_reports");
            e.Property(x => x.ResultSummary).HasMaxLength(1000).IsRequired();
            e.Property(x => x.ResultDetails).HasMaxLength(4000);
            e.Property(x => x.ReferenceRange).HasMaxLength(200);
            e.Property(x => x.ReportedBy).HasMaxLength(60).IsRequired();
            e.HasOne(x => x.Request).WithOne(r => r.Report).HasForeignKey<LabReport>(x => x.RequestId).OnDelete(DeleteBehavior.Cascade).HasConstraintName("fk_hdn_report_request");
            e.HasIndex(x => x.RequestId).IsUnique().HasDatabaseName("uk_report_request");
        });
    }
}

public class LaboratoryDbContextFactory : IDesignTimeDbContextFactory<LaboratoryDbContext>
{
    public LaboratoryDbContext CreateDbContext(string[] args)
    {
        var o = new DbContextOptionsBuilder<LaboratoryDbContext>();
        DbConnection.ConfigureDesignTime(o);
        return new LaboratoryDbContext(o.Options);
    }
}
