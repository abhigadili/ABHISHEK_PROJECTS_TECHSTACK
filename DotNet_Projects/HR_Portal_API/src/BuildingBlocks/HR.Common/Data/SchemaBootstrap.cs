using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace HR.Common.Data;

/// <summary>
/// Safe, non-destructive schema management: the existing (Java-created) schema is never altered or dropped. Only the .NET-owned
/// "dn_*" tables are created, with idempotent CREATE TABLE IF NOT EXISTS scripts recorded in dn_schema_history.
/// Also verifies that the tables this service depends on actually exist before it starts.
/// </summary>
public static class SchemaBootstrap
{
    private const string Outbox = """
        CREATE TABLE IF NOT EXISTS dn_outbox_events (
          id BIGINT NOT NULL AUTO_INCREMENT,
          event_id VARCHAR(64) NOT NULL,
          event_type VARCHAR(100) NOT NULL,
          topic VARCHAR(150) NOT NULL,
          event_key VARCHAR(100) NULL,
          payload MEDIUMTEXT NOT NULL,
          correlation_id VARCHAR(64) NULL,
          created_at DATETIME(6) NOT NULL,
          sent_at DATETIME(6) NULL,
          attempts INT NOT NULL DEFAULT 0,
          PRIMARY KEY (id),
          KEY idx_dn_outbox_unsent (sent_at, id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        """;

    private const string Inbox = """
        CREATE TABLE IF NOT EXISTS dn_processed_events (
          id BIGINT NOT NULL AUTO_INCREMENT,
          event_id VARCHAR(64) NOT NULL,
          consumer VARCHAR(120) NOT NULL,
          processed_at DATETIME(6) NOT NULL,
          PRIMARY KEY (id),
          UNIQUE KEY uk_dn_processed_event_consumer (event_id, consumer)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        """;

    private const string History = """
        CREATE TABLE IF NOT EXISTS dn_schema_history (
          version VARCHAR(80) NOT NULL,
          applied_at DATETIME(6) NOT NULL,
          PRIMARY KEY (version)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        """;

    public static async Task EnsureAsync(DbContext db, ILogger log, IEnumerable<string> requiredTables, IEnumerable<(string Version, string Sql)>? extraScripts = null)
    {
        for (var attempt = 1; ; attempt++)
        {
            try
            {
                await db.Database.ExecuteSqlRawAsync(History);
                foreach (var (version, sql) in new[] { ("001_dn_outbox_events", Outbox), ("002_dn_processed_events", Inbox) }.Concat(extraScripts ?? []))
                {
                    var applied = await db.Database.SqlQuery<int>($"SELECT COUNT(*) AS Value FROM dn_schema_history WHERE version = {version}").SingleAsync();
                    if (applied > 0) continue;
                    await db.Database.ExecuteSqlRawAsync(sql);      // static, developer-authored DDL only (never user input)
                    await db.Database.ExecuteSqlInterpolatedAsync($"INSERT INTO dn_schema_history (version, applied_at) VALUES ({version}, UTC_TIMESTAMP(6))");
                    log.LogInformation("Applied schema script {Version}", version);
                }
                var missing = new List<string>();
                foreach (var t in requiredTables)
                {
                    var exists = await db.Database.SqlQuery<int>($"SELECT COUNT(*) AS Value FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = {t}").SingleAsync();
                    if (exists == 0) missing.Add(t);
                }
                if (missing.Count > 0) throw new InvalidOperationException("Existing HR schema is missing tables: " + string.Join(", ", missing));
                return;
            }
            catch (Exception ex) when (attempt < 5 && ex is not InvalidOperationException)
            {
                log.LogWarning("Schema bootstrap attempt {Attempt} failed: {Error}", attempt, ex.Message);
                await Task.Delay(1500);
            }
        }
    }
}
