using CourseService.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace CourseService.Data.Configurations;

public class CategoryConfiguration : IEntityTypeConfiguration<CourseCategory>
{
    public void Configure(EntityTypeBuilder<CourseCategory> b)
    {
        b.ToTable("dn_course_categories");
        b.HasKey(x => x.CategoryId);
        b.Property(x => x.Name).HasMaxLength(80).IsRequired();
        b.Property(x => x.Description).HasMaxLength(255);
        b.Property(x => x.CreatedAt).HasColumnType("datetime(6)");
        b.HasIndex(x => x.Name).IsUnique().HasDatabaseName("uk_dn_course_categories_name");
    }
}

public class CourseConfiguration : IEntityTypeConfiguration<Course>
{
    public void Configure(EntityTypeBuilder<Course> b)
    {
        // CHECK = last line of defence against overselling: seats can never go negative or exceed capacity
        b.ToTable("dn_courses", t => t.HasCheckConstraint("chk_dn_courses_seats", "`AvailableSeats` >= 0 AND `AvailableSeats` <= `TotalSeats`"));
        b.HasKey(x => x.CourseId);
        b.Property(x => x.CourseName).HasMaxLength(120).IsRequired();
        b.Property(x => x.CourseCode).HasMaxLength(20).IsRequired();
        b.Property(x => x.Description).HasColumnType("text");
        b.Property(x => x.Fees).HasColumnType("decimal(10,2)");
        b.Property(x => x.Status).HasConversion<string>().HasMaxLength(10);
        b.Property(x => x.Version).IsConcurrencyToken();
        b.Property(x => x.CreatedAt).HasColumnType("datetime(6)");
        b.Property(x => x.UpdatedAt).HasColumnType("datetime(6)");
        // seat counters are only changed by atomic UPDATE statements, never by entity saves
        b.Property(x => x.TotalSeats).Metadata.SetAfterSaveBehavior(PropertySaveBehavior.Ignore);
        b.Property(x => x.AvailableSeats).Metadata.SetAfterSaveBehavior(PropertySaveBehavior.Ignore);
        b.HasIndex(x => x.CourseCode).IsUnique().HasDatabaseName("uk_dn_courses_code");
        b.HasIndex(x => x.Status).HasDatabaseName("idx_dn_courses_status");
        b.HasOne(x => x.Category).WithMany().HasForeignKey(x => x.CategoryId).OnDelete(DeleteBehavior.Restrict);
    }
}

public class SeatReservationConfiguration : IEntityTypeConfiguration<SeatReservation>
{
    public void Configure(EntityTypeBuilder<SeatReservation> b)
    {
        b.ToTable("dn_seat_reservations");
        b.HasKey(x => x.ReservationId);
        b.Property(x => x.Status).HasConversion<string>().HasMaxLength(10);
        b.Property(x => x.CreatedAt).HasColumnType("datetime(6)");
        b.Property(x => x.UpdatedAt).HasColumnType("datetime(6)");
        b.HasIndex(x => x.EnrollmentId).IsUnique().HasDatabaseName("uk_dn_seat_res_enrollment");
        b.HasIndex(x => new { x.CourseId, x.Status }).HasDatabaseName("idx_dn_seat_res_course");
        b.HasOne<Course>().WithMany().HasForeignKey(x => x.CourseId).OnDelete(DeleteBehavior.Restrict);
    }
}
