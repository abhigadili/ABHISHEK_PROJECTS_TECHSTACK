using System;
using System.Collections.Generic;
using HR.NotificationService.Entities;
using Microsoft.EntityFrameworkCore;

namespace HR.NotificationService.Data;

public partial class NotificationDbContext : HR.Common.Data.HrDbContext
{
    public NotificationDbContext(DbContextOptions<NotificationDbContext> options)
        : base(options)
    {
    }

    public virtual DbSet<AuditHistory> AuditHistories { get; set; }

    public virtual DbSet<EmailSetting> EmailSettings { get; set; }

    public virtual DbSet<EmployeeContact> EmployeeContacts { get; set; }

    public virtual DbSet<EventHistory> EventHistories { get; set; }

    public virtual DbSet<Notification> Notifications { get; set; }

    public virtual DbSet<NotificationTemplate> NotificationTemplates { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder
            .UseCollation("utf8mb4_0900_ai_ci")
            .HasCharSet("utf8mb4");

        modelBuilder.Entity<AuditHistory>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PRIMARY");

            entity.ToTable("audit_history");

            entity.HasIndex(e => e.CreatedAt, "idx_audit_created");

            entity.HasIndex(e => new { e.EntityType, e.EntityId }, "idx_audit_entity");

            entity.Property(e => e.Id)
                .HasMaxLength(36)
                .HasColumnName("id");
            entity.Property(e => e.Action)
                .HasMaxLength(60)
                .HasColumnName("action");
            entity.Property(e => e.CorrelationId)
                .HasMaxLength(64)
                .HasColumnName("correlation_id");
            entity.Property(e => e.CreatedAt)
                .HasMaxLength(6)
                .HasColumnName("created_at");
            entity.Property(e => e.EntityId)
                .HasMaxLength(64)
                .HasColumnName("entity_id");
            entity.Property(e => e.EntityType)
                .HasMaxLength(80)
                .HasColumnName("entity_type");
            entity.Property(e => e.NewValue)
                .HasColumnType("mediumtext")
                .HasColumnName("new_value");
            entity.Property(e => e.PreviousValue)
                .HasColumnType("mediumtext")
                .HasColumnName("previous_value");
            entity.Property(e => e.UserId)
                .HasMaxLength(100)
                .HasColumnName("user_id");
        });

        modelBuilder.Entity<EmailSetting>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PRIMARY");

            entity.ToTable("email_settings");

            entity.Property(e => e.Id)
                .HasMaxLength(36)
                .HasColumnName("id");
            entity.Property(e => e.CreatedAt)
                .HasMaxLength(6)
                .HasColumnName("created_at");
            entity.Property(e => e.CreatedBy)
                .HasMaxLength(100)
                .HasColumnName("created_by");
            entity.Property(e => e.Enabled)
                .HasColumnType("bit(1)")
                .HasColumnName("enabled");
            entity.Property(e => e.FromAddress)
                .HasMaxLength(150)
                .HasColumnName("from_address");
            entity.Property(e => e.Host)
                .HasMaxLength(150)
                .HasColumnName("host");
            entity.Property(e => e.Mode)
                .HasColumnType("enum('LOG','SMTP')")
                .HasColumnName("mode");
            entity.Property(e => e.Port).HasColumnName("port");
            entity.Property(e => e.StartTls)
                .HasColumnType("bit(1)")
                .HasColumnName("start_tls");
            entity.Property(e => e.UpdatedAt)
                .HasMaxLength(6)
                .HasColumnName("updated_at");
            entity.Property(e => e.UpdatedBy)
                .HasMaxLength(100)
                .HasColumnName("updated_by");
            entity.Property(e => e.Username)
                .HasMaxLength(150)
                .HasColumnName("username");
        });

        modelBuilder.Entity<EmployeeContact>(entity =>
        {
            entity.HasKey(e => e.EmployeeId).HasName("PRIMARY");

            entity.ToTable("employee_contacts");

            entity.Property(e => e.EmployeeId)
                .HasMaxLength(36)
                .HasColumnName("employee_id");
            entity.Property(e => e.Email)
                .HasMaxLength(150)
                .HasColumnName("email");
            entity.Property(e => e.FullName)
                .HasMaxLength(200)
                .HasColumnName("full_name");
            entity.Property(e => e.UpdatedAt)
                .HasMaxLength(6)
                .HasColumnName("updated_at");
        });

        modelBuilder.Entity<EventHistory>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PRIMARY");

            entity.ToTable("event_history");

            entity.HasIndex(e => new { e.EmployeeId, e.OccurredAt }, "idx_event_employee");

            entity.HasIndex(e => new { e.Topic, e.OccurredAt }, "idx_event_topic");

            entity.HasIndex(e => e.EventId, "uk_event_history_event").IsUnique();

            entity.Property(e => e.Id)
                .HasMaxLength(36)
                .HasColumnName("id");
            entity.Property(e => e.CorrelationId)
                .HasMaxLength(64)
                .HasColumnName("correlation_id");
            entity.Property(e => e.CreatedAt)
                .HasMaxLength(6)
                .HasColumnName("created_at");
            entity.Property(e => e.CreatedBy)
                .HasMaxLength(100)
                .HasColumnName("created_by");
            entity.Property(e => e.EmployeeId)
                .HasMaxLength(36)
                .HasColumnName("employee_id");
            entity.Property(e => e.EventId)
                .HasMaxLength(64)
                .HasColumnName("event_id");
            entity.Property(e => e.EventType)
                .HasMaxLength(100)
                .HasColumnName("event_type");
            entity.Property(e => e.OccurredAt)
                .HasMaxLength(6)
                .HasColumnName("occurred_at");
            entity.Property(e => e.OffsetNo).HasColumnName("offset_no");
            entity.Property(e => e.PartitionNo).HasColumnName("partition_no");
            entity.Property(e => e.Payload)
                .HasColumnType("mediumtext")
                .HasColumnName("payload");
            entity.Property(e => e.SourceService)
                .HasMaxLength(60)
                .HasColumnName("source_service");
            entity.Property(e => e.Topic)
                .HasMaxLength(100)
                .HasColumnName("topic");
            entity.Property(e => e.UpdatedAt)
                .HasMaxLength(6)
                .HasColumnName("updated_at");
            entity.Property(e => e.UpdatedBy)
                .HasMaxLength(100)
                .HasColumnName("updated_by");
        });

        modelBuilder.Entity<Notification>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PRIMARY");

            entity.ToTable("notifications");

            entity.HasIndex(e => new { e.RecipientEmployeeId, e.Channel, e.ReadAt, e.CreatedAt }, "idx_notification_recipient");

            entity.HasIndex(e => new { e.Status, e.CreatedAt }, "idx_notification_status");

            entity.Property(e => e.Id)
                .HasMaxLength(36)
                .HasColumnName("id");
            entity.Property(e => e.Body)
                .HasMaxLength(2000)
                .HasColumnName("body");
            entity.Property(e => e.Channel)
                .HasColumnType("enum('EMAIL','IN_APP')")
                .HasColumnName("channel");
            entity.Property(e => e.CorrelationId)
                .HasMaxLength(64)
                .HasColumnName("correlation_id");
            entity.Property(e => e.CreatedAt)
                .HasMaxLength(6)
                .HasColumnName("created_at");
            entity.Property(e => e.CreatedBy)
                .HasMaxLength(100)
                .HasColumnName("created_by");
            entity.Property(e => e.ErrorMessage)
                .HasMaxLength(200)
                .HasColumnName("error_message");
            entity.Property(e => e.ReadAt)
                .HasMaxLength(6)
                .HasColumnName("read_at");
            entity.Property(e => e.RecipientEmail)
                .HasMaxLength(150)
                .HasColumnName("recipient_email");
            entity.Property(e => e.RecipientEmployeeId)
                .HasMaxLength(36)
                .HasColumnName("recipient_employee_id");
            entity.Property(e => e.ReferenceId)
                .HasMaxLength(64)
                .HasColumnName("reference_id");
            entity.Property(e => e.ReferenceType)
                .HasMaxLength(40)
                .HasColumnName("reference_type");
            entity.Property(e => e.SentAt)
                .HasMaxLength(6)
                .HasColumnName("sent_at");
            entity.Property(e => e.Status)
                .HasColumnType("enum('FAILED','PENDING','SENT','SKIPPED')")
                .HasColumnName("status");
            entity.Property(e => e.Subject)
                .HasMaxLength(200)
                .HasColumnName("subject");
            entity.Property(e => e.Type)
                .HasMaxLength(60)
                .HasColumnName("type");
            entity.Property(e => e.UpdatedAt)
                .HasMaxLength(6)
                .HasColumnName("updated_at");
            entity.Property(e => e.UpdatedBy)
                .HasMaxLength(100)
                .HasColumnName("updated_by");
        });

        modelBuilder.Entity<NotificationTemplate>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PRIMARY");

            entity.ToTable("notification_templates");

            entity.HasIndex(e => e.Code, "uk_template_code").IsUnique();

            entity.Property(e => e.Id)
                .HasMaxLength(36)
                .HasColumnName("id");
            entity.Property(e => e.Active)
                .HasColumnType("bit(1)")
                .HasColumnName("active");
            entity.Property(e => e.BodyTemplate)
                .HasMaxLength(2000)
                .HasColumnName("body_template");
            entity.Property(e => e.Code)
                .HasMaxLength(60)
                .HasColumnName("code");
            entity.Property(e => e.CreatedAt)
                .HasMaxLength(6)
                .HasColumnName("created_at");
            entity.Property(e => e.CreatedBy)
                .HasMaxLength(100)
                .HasColumnName("created_by");
            entity.Property(e => e.Description)
                .HasMaxLength(200)
                .HasColumnName("description");
            entity.Property(e => e.SubjectTemplate)
                .HasMaxLength(200)
                .HasColumnName("subject_template");
            entity.Property(e => e.UpdatedAt)
                .HasMaxLength(6)
                .HasColumnName("updated_at");
            entity.Property(e => e.UpdatedBy)
                .HasMaxLength(100)
                .HasColumnName("updated_by");
        });

        OnModelCreatingPartial(modelBuilder);
    }

    partial void OnModelCreatingPartial(ModelBuilder modelBuilder);
}
