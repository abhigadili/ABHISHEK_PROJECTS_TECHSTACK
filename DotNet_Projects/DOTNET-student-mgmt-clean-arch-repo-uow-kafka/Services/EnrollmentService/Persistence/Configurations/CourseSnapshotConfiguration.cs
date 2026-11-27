using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using StudentMgmt.EnrollmentService.Entities;

namespace StudentMgmt.EnrollmentService.Persistence.Configurations;

public class CourseSnapshotConfiguration : IEntityTypeConfiguration<CourseSnapshot>
{
    public void Configure(EntityTypeBuilder<CourseSnapshot> builder)
    {
        builder.ToTable("CourseSnapshots");

        // Id is deliberately set by SnapshotSyncService to equal the CourseId
        // carried on the Kafka event (see StudentSnapshotConfiguration for the
        // same pattern), never database-generated.
        builder.HasKey(c => c.Id);
        builder.Property(c => c.Id).ValueGeneratedNever();

        builder.Property(c => c.Title).IsRequired().HasMaxLength(200);
        builder.Property(c => c.Capacity).IsRequired();
        builder.Property(c => c.EnrolledCount).IsRequired();

        builder.Property(c => c.CreatedBy).IsRequired().HasMaxLength(100);
        builder.Property(c => c.UpdatedBy).HasMaxLength(100);
        builder.Property(c => c.DeletedBy).HasMaxLength(100);

        builder.Property(c => c.RowVersion).IsConcurrencyToken();

        builder.HasQueryFilter(c => !c.IsDeleted);
    }
}
