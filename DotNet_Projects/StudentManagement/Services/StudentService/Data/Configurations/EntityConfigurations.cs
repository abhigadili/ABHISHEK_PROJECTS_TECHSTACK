using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using StudentService.Entities;

namespace StudentService.Data.Configurations;

public class StudentConfiguration : IEntityTypeConfiguration<Student>
{
    public void Configure(EntityTypeBuilder<Student> b)
    {
        b.ToTable("dn_students");
        b.HasKey(x => x.StudentId);
        b.Property(x => x.StudentId).ValueGeneratedOnAdd();
        b.Property(x => x.FirstName).HasMaxLength(50).IsRequired();
        b.Property(x => x.LastName).HasMaxLength(50).IsRequired();
        b.Property(x => x.Email).HasMaxLength(100).IsRequired();
        b.Property(x => x.PhoneNumber).HasMaxLength(20);
        b.Property(x => x.DateOfBirth).HasColumnType("date");
        b.Property(x => x.EnrollmentDate).HasColumnType("date");
        b.Property(x => x.Gender).HasConversion<string>().HasMaxLength(10);
        b.Property(x => x.Status).HasConversion<string>().HasMaxLength(10).IsRequired();
        b.Property(x => x.Address).HasMaxLength(255);
        b.Property(x => x.CreatedAt).HasColumnType("datetime(6)");
        b.Property(x => x.UpdatedAt).HasColumnType("datetime(6)");
        b.HasIndex(x => x.Email).IsUnique().HasDatabaseName("uk_dn_students_email");
        b.HasIndex(x => x.Status).HasDatabaseName("idx_dn_students_status");
        b.HasIndex(x => new { x.LastName, x.FirstName }).HasDatabaseName("idx_dn_students_name");
    }
}

public class AppUserConfiguration : IEntityTypeConfiguration<AppUser>
{
    public void Configure(EntityTypeBuilder<AppUser> b)
    {
        b.Property(x => x.CreatedAt).HasColumnType("datetime(6)");
        b.HasIndex(x => x.StudentId).HasDatabaseName("idx_dn_users_student");
        // Deleting a student profile removes its login (same DB, so a real FK is allowed here)
        b.HasOne<Student>().WithMany().HasForeignKey(x => x.StudentId).OnDelete(DeleteBehavior.Cascade);
    }
}

public class RefreshTokenConfiguration : IEntityTypeConfiguration<RefreshToken>
{
    public void Configure(EntityTypeBuilder<RefreshToken> b)
    {
        b.ToTable("dn_refresh_tokens");
        b.HasKey(x => x.RefreshTokenId);
        b.Property(x => x.TokenHash).HasColumnType("char(64)").IsRequired();
        b.Property(x => x.ExpiresAt).HasColumnType("datetime(6)");
        b.Property(x => x.CreatedAt).HasColumnType("datetime(6)");
        b.HasIndex(x => x.TokenHash).IsUnique().HasDatabaseName("uk_dn_refresh_token_hash");
        b.HasIndex(x => x.UserId).HasDatabaseName("idx_dn_refresh_user");
        b.HasOne<AppUser>().WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
    }
}
