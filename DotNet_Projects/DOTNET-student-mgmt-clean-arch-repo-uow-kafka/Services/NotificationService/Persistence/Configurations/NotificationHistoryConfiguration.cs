using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using StudentMgmt.NotificationService.Entities;

namespace StudentMgmt.NotificationService.Persistence.Configurations;

public class NotificationHistoryConfiguration : IEntityTypeConfiguration<NotificationHistory>
{
    public void Configure(EntityTypeBuilder<NotificationHistory> builder)
    {
        builder.ToTable("NotificationHistories");

        builder.HasKey(n => n.Id);

        builder.Property(n => n.Channel)
            .HasConversion<string>()
            .HasMaxLength(20)
            .IsRequired();

        builder.Property(n => n.RecipientEmail)
            .HasMaxLength(256)
            .IsRequired();

        builder.Property(n => n.RecipientPhoneNumber)
            .HasMaxLength(32);

        builder.Property(n => n.Subject)
            .HasMaxLength(256)
            .IsRequired();

        builder.Property(n => n.Body)
            .HasColumnType("text")
            .IsRequired();

        builder.Property(n => n.Success)
            .IsRequired();

        builder.Property(n => n.FailureReason)
            .HasMaxLength(1024);

        builder.Property(n => n.SentOnUtc)
            .IsRequired();

        builder.Property(n => n.TriggeredByEvent)
            .HasMaxLength(128)
            .IsRequired();

        builder.Property(n => n.CreatedBy)
            .HasMaxLength(128);

        builder.Property(n => n.UpdatedBy)
            .HasMaxLength(128);

        builder.Property(n => n.DeletedBy)
            .HasMaxLength(128);

        builder.Property(n => n.RowVersion)
            .IsRowVersion();

        builder.HasIndex(n => new { n.RecipientEmail, n.SentOnUtc })
            .HasDatabaseName("IX_NotificationHistories_RecipientEmail_SentOnUtc");

        builder.HasQueryFilter(n => !n.IsDeleted);
    }
}
