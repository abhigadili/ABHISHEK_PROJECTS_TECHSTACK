using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using StudentMgmt.StudentService.Entities;

namespace StudentMgmt.StudentService.Persistence.Configurations;

public class UserRoleConfiguration : IEntityTypeConfiguration<UserRole>
{
    public void Configure(EntityTypeBuilder<UserRole> builder)
    {
        builder.ToTable("UserRoles");

        builder.HasKey(ur => ur.Id);

        builder.Property(ur => ur.CreatedBy).IsRequired().HasMaxLength(100);
        builder.Property(ur => ur.UpdatedBy).HasMaxLength(100);
        builder.Property(ur => ur.DeletedBy).HasMaxLength(100);

        builder.Property(ur => ur.RowVersion).IsConcurrencyToken();

        builder.HasIndex(ur => new { ur.UserId, ur.RoleId }).IsUnique();

        builder.HasQueryFilter(ur => !ur.IsDeleted);
    }
}
