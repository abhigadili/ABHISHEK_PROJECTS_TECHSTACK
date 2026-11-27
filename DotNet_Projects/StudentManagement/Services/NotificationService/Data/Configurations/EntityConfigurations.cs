using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using NotificationService.Entities;

namespace NotificationService.Data.Configurations;

public class NotificationConfiguration : IEntityTypeConfiguration<Notification>
{
    public void Configure(EntityTypeBuilder<Notification> b)
    {
        b.ToTable("dn_notifications");
        b.HasKey(x => x.NotificationId);
        b.Property(x => x.NotificationType).HasConversion<string>().HasMaxLength(30).IsRequired();
        b.Property(x => x.RecipientEmail).HasMaxLength(100);
        b.Property(x => x.Message).HasColumnType("text").IsRequired();
        b.Property(x => x.Status).HasConversion<string>().HasMaxLength(10).IsRequired();
        b.Property(x => x.LastError).HasMaxLength(500);
        b.Property(x => x.Version).IsConcurrencyToken();
        b.Property(x => x.NextAttemptAt).HasColumnType("datetime(6)");
        b.Property(x => x.CreatedAt).HasColumnType("datetime(6)");
        b.Property(x => x.ProcessedAt).HasColumnType("datetime(6)");
        // duplicate-notification guard: one notification per (enrollment, type); NULL enrollment ids (low-availability alerts) are not constrained
        b.HasIndex(x => new { x.EnrollmentId, x.NotificationType }).IsUnique().HasDatabaseName("uk_dn_notifications_enrollment_type");
        b.HasIndex(x => new { x.Status, x.NextAttemptAt }).HasDatabaseName("idx_dn_notifications_due");
        b.HasIndex(x => new { x.StudentId, x.CreatedAt }).HasDatabaseName("idx_dn_notifications_student");
    }
}

public class InboxMessageConfiguration : IEntityTypeConfiguration<InboxMessage>
{
    public void Configure(EntityTypeBuilder<InboxMessage> b)
    {
        b.ToTable("dn_inbox_messages");
        b.HasKey(x => x.InboxId);
        b.Property(x => x.MessageId).HasMaxLength(64).IsRequired();
        b.Property(x => x.Queue).HasMaxLength(100).IsRequired();
        b.Property(x => x.ConsumerGroup).HasMaxLength(100).IsRequired();
        b.Property(x => x.ReceivedAt).HasColumnType("datetime(6)");
        b.HasIndex(x => new { x.MessageId, x.ConsumerGroup }).IsUnique().HasDatabaseName("uk_dn_inbox_message");
    }
}
