using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using StudentMgmt.StudentService.Entities;

namespace StudentMgmt.StudentService.Persistence.Configurations;

public class StudentConfiguration : IEntityTypeConfiguration<Student>
{
    public void Configure(EntityTypeBuilder<Student> builder)
    {
        builder.ToTable("Students");

        builder.HasKey(s => s.Id);

        builder.Property(s => s.FirstName).IsRequired().HasMaxLength(100);
        builder.Property(s => s.LastName).IsRequired().HasMaxLength(100);
        builder.Property(s => s.Email).IsRequired().HasMaxLength(256);
        builder.Property(s => s.PhoneNumber).HasMaxLength(30);
        builder.Property(s => s.Address).HasMaxLength(500);
        builder.Property(s => s.EnrollmentNumber).IsRequired().HasMaxLength(50);
        builder.Property(s => s.CreatedBy).IsRequired().HasMaxLength(100);
        builder.Property(s => s.UpdatedBy).HasMaxLength(100);
        builder.Property(s => s.DeletedBy).HasMaxLength(100);

        builder.Property(s => s.RowVersion).IsConcurrencyToken();

        builder.HasIndex(s => s.Email).IsUnique();
        builder.HasIndex(s => s.EnrollmentNumber).IsUnique();

        builder.HasQueryFilter(s => !s.IsDeleted);
    }
}
