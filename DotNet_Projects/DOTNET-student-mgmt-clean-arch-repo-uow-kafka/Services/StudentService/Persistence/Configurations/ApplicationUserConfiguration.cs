using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using StudentMgmt.StudentService.Entities;

namespace StudentMgmt.StudentService.Persistence.Configurations;

public class ApplicationUserConfiguration : IEntityTypeConfiguration<ApplicationUser>
{
    public void Configure(EntityTypeBuilder<ApplicationUser> builder)
    {
        builder.ToTable("Users");

        builder.HasKey(u => u.Id);

        builder.Property(u => u.FullName).IsRequired().HasMaxLength(200);
        builder.Property(u => u.Email).IsRequired().HasMaxLength(256);
        builder.Property(u => u.PasswordHash).IsRequired().HasMaxLength(500);
        builder.Property(u => u.CreatedBy).IsRequired().HasMaxLength(100);
        builder.Property(u => u.UpdatedBy).HasMaxLength(100);
        builder.Property(u => u.DeletedBy).HasMaxLength(100);

        builder.Property(u => u.RowVersion).IsConcurrencyToken();

        builder.HasIndex(u => u.Email).IsUnique();

        builder.HasQueryFilter(u => !u.IsDeleted);
    }
}
