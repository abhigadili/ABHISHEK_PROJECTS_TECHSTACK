using EnrollmentService.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EnrollmentService.Data.Configurations;

public class EnrollmentConfiguration : IEntityTypeConfiguration<Enrollment>
{
    public void Configure(EntityTypeBuilder<Enrollment> b)
    {
        b.ToTable("dn_enrollments");
        b.HasKey(x => x.EnrollmentId);
        b.Property(x => x.StudentName).HasMaxLength(120);
        b.Property(x => x.StudentEmail).HasMaxLength(100);
        b.Property(x => x.CourseName).HasMaxLength(120);
        b.Property(x => x.EnrollmentDate).HasColumnType("datetime(6)");
        b.Property(x => x.Status).HasConversion<string>().HasMaxLength(10).IsRequired();
        b.Property(x => x.IdempotencyKey).HasMaxLength(64).IsRequired();
        b.Property(x => x.Remarks).HasMaxLength(500);
        // duplicate-enrollment guard: only Pending/Confirmed rows get a key; the UNIQUE index ignores NULLs
        b.Property(x => x.ActiveKey).HasMaxLength(45)
            .HasComputedColumnSql("CASE WHEN `Status` IN ('Pending','Confirmed') THEN CONCAT(`StudentId`, '-', `CourseId`) ELSE NULL END", stored: true);
        b.Property(x => x.Version).IsConcurrencyToken();
        b.Property(x => x.CreatedAt).HasColumnType("datetime(6)");
        b.Property(x => x.UpdatedAt).HasColumnType("datetime(6)");
        b.HasIndex(x => x.IdempotencyKey).IsUnique().HasDatabaseName("uk_dn_enrollments_idem");
        b.HasIndex(x => x.ActiveKey).IsUnique().HasDatabaseName("uk_dn_enrollments_active");
        b.HasIndex(x => new { x.StudentId, x.CreatedAt }).HasDatabaseName("idx_dn_enrollments_student");
        b.HasIndex(x => new { x.CourseId, x.Status }).HasDatabaseName("idx_dn_enrollments_course");
    }
}

public class SagaConfiguration : IEntityTypeConfiguration<SagaInstance>
{
    public void Configure(EntityTypeBuilder<SagaInstance> b)
    {
        b.ToTable("dn_saga_instances");
        b.HasKey(x => x.SagaId);
        b.Property(x => x.IdempotencyKey).HasMaxLength(64).IsRequired();
        b.Property(x => x.State).HasConversion<string>().HasMaxLength(20).IsRequired();
        b.Property(x => x.FailureReason).HasMaxLength(500);
        b.Property(x => x.StudentName).HasMaxLength(120);
        b.Property(x => x.StudentEmail).HasMaxLength(100);
        b.Property(x => x.CourseName).HasMaxLength(120);
        b.Property(x => x.CorrelationId).HasMaxLength(64);
        b.Property(x => x.Version).IsConcurrencyToken();
        b.Property(x => x.CreatedAt).HasColumnType("datetime(6)");
        b.Property(x => x.UpdatedAt).HasColumnType("datetime(6)");
        b.HasIndex(x => x.IdempotencyKey).IsUnique().HasDatabaseName("uk_dn_saga_idem");
        b.HasIndex(x => new { x.State, x.UpdatedAt }).HasDatabaseName("idx_dn_saga_state");
    }
}

public class OutboxConfiguration : IEntityTypeConfiguration<OutboxMessage>
{
    public void Configure(EntityTypeBuilder<OutboxMessage> b)
    {
        b.ToTable("dn_outbox_messages");
        b.HasKey(x => x.OutboxId);
        b.Property(x => x.EventId).HasMaxLength(36).IsRequired();
        b.Property(x => x.EventType).HasMaxLength(40).IsRequired();
        b.Property(x => x.RoutingKey).HasMaxLength(100).IsRequired();
        b.Property(x => x.Payload).HasColumnType("longtext").IsRequired();
        b.Property(x => x.CorrelationId).HasMaxLength(64);
        b.Property(x => x.Status).HasConversion<string>().HasMaxLength(10).IsRequired();
        b.Property(x => x.LastError).HasMaxLength(500);
        b.Property(x => x.NextAttemptAt).HasColumnType("datetime(6)");
        b.Property(x => x.CreatedAt).HasColumnType("datetime(6)");
        b.Property(x => x.PublishedAt).HasColumnType("datetime(6)");
        b.HasIndex(x => x.EventId).IsUnique().HasDatabaseName("uk_dn_outbox_event_id");
        b.HasIndex(x => new { x.Status, x.NextAttemptAt, x.OutboxId }).HasDatabaseName("idx_dn_outbox_pending");
    }
}
