using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using StudentMgmt.EnrollmentService.Entities;

namespace StudentMgmt.EnrollmentService.Persistence.Configurations;

public class EnrollmentConfiguration : IEntityTypeConfiguration<Enrollment>
{
    public void Configure(EntityTypeBuilder<Enrollment> builder)
    {
        builder.ToTable("Enrollments");

        builder.HasKey(e => e.Id);

        builder.Property(e => e.Status)
            .HasConversion<string>()
            .HasMaxLength(20)
            .IsRequired();

        builder.Property(e => e.CancellationReason).HasMaxLength(500);

        builder.Property(e => e.CreatedBy).IsRequired().HasMaxLength(100);
        builder.Property(e => e.UpdatedBy).HasMaxLength(100);
        builder.Property(e => e.DeletedBy).HasMaxLength(100);

        builder.Property(e => e.RowVersion).IsConcurrencyToken();

        builder.HasIndex(e => e.StudentId);
        builder.HasIndex(e => e.CourseId);

        // NOTE: The spec calls for a unique index on (StudentId, CourseId) filtered
        // to only "not cancelled" rows. MySQL (unlike SQL Server) does not support
        // partial/filtered indexes at all, and EF Core's HasFilter(...) is a no-op
        // for the Pomelo MySQL provider, so a filtered unique index cannot be
        // expressed here. Deliberate choice: enforce "no duplicate active
        // enrollment for the same student+course" purely in application logic in
        // EnrollmentAppService.EnrollAsync (via HasActiveEnrollmentAsync before
        // insert), and add a plain non-unique composite index here purely for
        // query performance (e.g. history/status lookups).
        builder.HasIndex(e => new { e.StudentId, e.CourseId });

        builder.HasQueryFilter(e => !e.IsDeleted);
    }
}
