using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using StudentMgmt.CourseService.Entities;

namespace StudentMgmt.CourseService.Persistence.Configurations;

public class CourseConfiguration : IEntityTypeConfiguration<Course>
{
    public void Configure(EntityTypeBuilder<Course> builder)
    {
        builder.ToTable("Courses");

        builder.HasKey(c => c.Id);

        builder.Property(c => c.CourseCode)
            .IsRequired()
            .HasMaxLength(10);

        builder.HasIndex(c => c.CourseCode)
            .IsUnique();

        builder.Property(c => c.Title)
            .IsRequired()
            .HasMaxLength(200);

        builder.Property(c => c.Description)
            .HasMaxLength(2000);

        builder.Property(c => c.InstructorName)
            .IsRequired()
            .HasMaxLength(200);

        builder.Property(c => c.Credits)
            .IsRequired();

        builder.Property(c => c.Capacity)
            .IsRequired();

        builder.Property(c => c.IsActive)
            .IsRequired()
            .HasDefaultValue(true);

        builder.Property(c => c.CreatedBy)
            .IsRequired()
            .HasMaxLength(100);

        builder.Property(c => c.UpdatedBy)
            .HasMaxLength(100);

        builder.Property(c => c.DeletedBy)
            .HasMaxLength(100);

        // MySQL has no native rowversion type, so RowVersion is a plain
        // byte[] column configured as a concurrency token; the repository is
        // responsible for assigning it a fresh value on every update.
        builder.Property(c => c.RowVersion)
            .IsConcurrencyToken();
    }
}
