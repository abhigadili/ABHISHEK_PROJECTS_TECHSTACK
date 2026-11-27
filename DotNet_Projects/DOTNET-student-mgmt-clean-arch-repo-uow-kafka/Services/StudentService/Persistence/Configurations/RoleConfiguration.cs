using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using StudentMgmt.StudentService.Entities;

namespace StudentMgmt.StudentService.Persistence.Configurations;

public class RoleConfiguration : IEntityTypeConfiguration<Role>
{
    public void Configure(EntityTypeBuilder<Role> builder)
    {
        builder.ToTable("Roles");

        builder.HasKey(r => r.Id);

        builder.Property(r => r.Name).IsRequired().HasMaxLength(100);
        builder.Property(r => r.CreatedBy).IsRequired().HasMaxLength(100);
        builder.Property(r => r.UpdatedBy).HasMaxLength(100);
        builder.Property(r => r.DeletedBy).HasMaxLength(100);

        builder.Property(r => r.RowVersion).IsConcurrencyToken();

        builder.HasIndex(r => r.Name).IsUnique();

        builder.HasQueryFilter(r => !r.IsDeleted);
    }
}
