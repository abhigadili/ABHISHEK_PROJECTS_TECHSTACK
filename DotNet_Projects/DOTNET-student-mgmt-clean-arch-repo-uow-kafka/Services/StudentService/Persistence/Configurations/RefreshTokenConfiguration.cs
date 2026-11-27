using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using StudentMgmt.StudentService.Entities;

namespace StudentMgmt.StudentService.Persistence.Configurations;

public class RefreshTokenConfiguration : IEntityTypeConfiguration<RefreshToken>
{
    public void Configure(EntityTypeBuilder<RefreshToken> builder)
    {
        builder.ToTable("RefreshTokens");

        builder.HasKey(rt => rt.Id);

        builder.Property(rt => rt.Token).IsRequired().HasMaxLength(500);
        builder.Property(rt => rt.CreatedByIp).HasMaxLength(64);
        builder.Property(rt => rt.ReplacedByToken).HasMaxLength(500);
        builder.Property(rt => rt.CreatedBy).IsRequired().HasMaxLength(100);
        builder.Property(rt => rt.UpdatedBy).HasMaxLength(100);
        builder.Property(rt => rt.DeletedBy).HasMaxLength(100);

        builder.Property(rt => rt.RowVersion).IsConcurrencyToken();

        builder.HasIndex(rt => rt.Token).IsUnique();
        builder.Ignore(rt => rt.IsActive);

        builder.HasQueryFilter(rt => !rt.IsDeleted);
    }
}
