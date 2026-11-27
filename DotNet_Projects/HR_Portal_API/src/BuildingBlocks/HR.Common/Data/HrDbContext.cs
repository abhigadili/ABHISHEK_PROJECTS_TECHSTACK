using System.Linq.Expressions;
using System.Reflection;
using HR.Common.Messaging;
using Microsoft.EntityFrameworkCore;

namespace HR.Common.Data;

/// <summary>
/// Base DbContext of every service. Adds the .NET outbox/inbox tables (prefixed "dn_" so they never collide with the Java/Node
/// builds' tables in the same database) and applies cross-cutting conventions to the scaffolded (Database First) model:
/// optimistic concurrency on "version", global soft-delete query filter on "deleted", UTC DateTime handling.
/// </summary>
public abstract class HrDbContext(DbContextOptions options) : DbContext(options)
{
    public DbSet<OutboxMessage> Outbox => Set<OutboxMessage>();
    public DbSet<InboxMessage> Inbox => Set<InboxMessage>();

    protected void ApplyHrConventions(ModelBuilder b)
    {
        b.Entity<OutboxMessage>(e =>
        {
            e.ToTable("dn_outbox_events");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.CreatedAt).HasColumnName("created_at");
            e.Property(x => x.SentAt).HasColumnName("sent_at");
            e.Property(x => x.Attempts).HasColumnName("attempts");
            e.Property(x => x.Topic).HasColumnName("topic").HasMaxLength(150).IsRequired();
            e.Property(x => x.EventKey).HasColumnName("event_key").HasMaxLength(100);
            e.Property(x => x.EventType).HasColumnName("event_type").HasMaxLength(100).IsRequired();
            e.Property(x => x.EventId).HasColumnName("event_id").HasMaxLength(64).IsRequired();
            e.Property(x => x.CorrelationId).HasColumnName("correlation_id").HasMaxLength(64);
            e.Property(x => x.Payload).HasColumnName("payload").HasColumnType("mediumtext").IsRequired();
            e.HasIndex(x => new { x.SentAt, x.Id }).HasDatabaseName("idx_dn_outbox_unsent");
        });
        b.Entity<InboxMessage>(e =>
        {
            e.ToTable("dn_processed_events");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.EventId).HasColumnName("event_id").HasMaxLength(64).IsRequired();
            e.Property(x => x.Consumer).HasColumnName("consumer").HasMaxLength(120).IsRequired();
            e.Property(x => x.ProcessedAt).HasColumnName("processed_at");
            e.HasIndex(x => new { x.EventId, x.Consumer }).IsUnique().HasDatabaseName("uk_dn_processed_event_consumer");
        });

        foreach (var et in b.Model.GetEntityTypes().Where(t => !t.IsKeyless && t.ClrType != typeof(OutboxMessage) && t.ClrType != typeof(InboxMessage)).ToList())
        {
            var key = et.FindPrimaryKey();
            if (key is { Properties.Count: 1 } && key.Properties[0].Name == "Id" && key.Properties[0].ClrType == typeof(string))
                b.Entity(et.ClrType).Property("Id").HasValueGenerator<UuidStringGenerator>().ValueGeneratedOnAdd();   // Java-compatible UUID string ids

            var version = et.FindProperty("Version");
            if (version is not null && version.ClrType == typeof(long)) b.Entity(et.ClrType).Property("Version").IsConcurrencyToken();

            var deleted = et.FindProperty("Deleted");
            if (deleted is not null && deleted.ClrType == typeof(bool) && et.BaseType is null)
            {
                var p = Expression.Parameter(et.ClrType, "e");
                var body = Expression.Not(Expression.Property(p, "Deleted"));
                b.Entity(et.ClrType).HasQueryFilter(Expression.Lambda(body, p));   // global query filter: soft-deleted rows are invisible
            }
        }
    }

    protected override void ConfigureConventions(ModelConfigurationBuilder cfg)
    {
        cfg.Properties<DateTime>().HaveConversion<UtcDateTimeConverter>();
        cfg.Properties<DateTime?>().HaveConversion<NullableUtcDateTimeConverter>();
    }
}

public sealed class UtcDateTimeConverter() : Microsoft.EntityFrameworkCore.Storage.ValueConversion.ValueConverter<DateTime, DateTime>(
    v => v.Kind == DateTimeKind.Local ? v.ToUniversalTime() : v, v => DateTime.SpecifyKind(v, DateTimeKind.Utc));

public sealed class NullableUtcDateTimeConverter() : Microsoft.EntityFrameworkCore.Storage.ValueConversion.ValueConverter<DateTime?, DateTime?>(
    v => v.HasValue && v.Value.Kind == DateTimeKind.Local ? v.Value.ToUniversalTime() : v, v => v.HasValue ? DateTime.SpecifyKind(v.Value, DateTimeKind.Utc) : v);

/// <summary>Client-side UUID (string, 36 chars) key generator - same id format the Java application uses.</summary>
public sealed class UuidStringGenerator : Microsoft.EntityFrameworkCore.ValueGeneration.ValueGenerator<string>
{
    public override bool GeneratesTemporaryValues => false;
    public override string Next(Microsoft.EntityFrameworkCore.ChangeTracking.EntityEntry entry) => Guid.NewGuid().ToString();
}
