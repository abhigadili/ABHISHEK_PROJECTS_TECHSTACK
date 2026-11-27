using HMS.Shared.Messaging;
using Microsoft.EntityFrameworkCore;

namespace HMS.Shared.Data;

/// <summary>Base DbContext of every event-publishing/consuming service: adds the outbox and inbox tables (prefix "hdn_").</summary>
public abstract class ServiceDbContext(DbContextOptions options) : DbContext(options)
{
    public DbSet<OutboxMessage> Outbox => Set<OutboxMessage>();
    public DbSet<InboxMessage> Inbox => Set<InboxMessage>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        base.OnModelCreating(b);
        b.Entity<OutboxMessage>(e =>
        {
            e.ToTable("hdn_outbox_messages");
            e.HasKey(x => x.Id);
            e.Property(x => x.Topic).HasMaxLength(150).IsRequired();
            e.Property(x => x.Key).HasMaxLength(100).IsRequired();
            e.Property(x => x.EventType).HasMaxLength(100).IsRequired();
            e.Property(x => x.CorrelationId).HasMaxLength(64);
            e.Property(x => x.Payload).HasColumnType("mediumtext").IsRequired();
            e.HasIndex(x => new { x.SentAt, x.Id }).HasDatabaseName("idx_outbox_unsent");
        });
        b.Entity<InboxMessage>(e =>
        {
            e.ToTable("hdn_inbox_messages");
            e.HasKey(x => x.Id);
            e.Property(x => x.Consumer).HasMaxLength(120).IsRequired();
            e.HasIndex(x => new { x.EventId, x.Consumer }).IsUnique().HasDatabaseName("uk_inbox_event_consumer");
        });
    }
}

public static class DbConnection
{
    /// <summary>Connection string from configuration; the password is only ever read from the environment (MYSQL_PASSWORD).</summary>
    public static string Build(Microsoft.Extensions.Configuration.IConfiguration cfg, string database)
    {
        var host = cfg["MYSQL_HOST"] ?? cfg["Database:Host"] ?? "localhost";
        var port = cfg["MYSQL_PORT"] ?? cfg["Database:Port"] ?? "3306";
        var user = cfg["MYSQL_USER"] ?? cfg["Database:User"] ?? "abhig";
        var pwd = cfg["MYSQL_PASSWORD"] ?? throw new InvalidOperationException("MYSQL_PASSWORD is not set (see .env.example)");
        return $"Server={host};Port={port};Database={database};User={user};Password={pwd};SslMode=None;AllowPublicKeyRetrieval=True;CharSet=utf8mb4;DefaultCommandTimeout=30";
    }

    public static void Configure(DbContextOptionsBuilder o, string connectionString) =>
        o.UseMySql(connectionString, new MySqlServerVersion(new Version(8, 0, 0)), m =>
        {
            m.MigrationsHistoryTable("__hdn_migrations_history");   // never clashes with other apps' __EFMigrationsHistory
            m.EnableRetryOnFailure(3);
        });

    /// <summary>Design-time (migrations) options: no connection is opened.</summary>
    public static void ConfigureDesignTime(DbContextOptionsBuilder o) =>
        o.UseMySql("Server=localhost;Database=design;User=design;Password=design", new MySqlServerVersion(new Version(8, 0, 0)),
            m => m.MigrationsHistoryTable("__hdn_migrations_history"));
}

public static class DbContextExtensions
{
    /// <summary>
    /// Runs the work (typically: SaveChanges to obtain generated ids, stage outbox events, SaveChanges again) in ONE database transaction,
    /// wrapped by the EF execution strategy. Events become visible to the relay only if the whole unit of work commits.
    /// </summary>
    public static Task InTransactionAsync(this DbContext db, Func<Task> work, CancellationToken ct = default)
    {
        // already inside a transaction (e.g. a Kafka handler running in the consumer's inbox transaction): just join it
        if (db.Database.CurrentTransaction is not null) return work();
        var strategy = db.Database.CreateExecutionStrategy();
        return strategy.ExecuteAsync(async () =>
        {
            await using var tx = await db.Database.BeginTransactionAsync(ct);
            await work();
            await tx.CommitAsync(ct);
        });
    }
}
