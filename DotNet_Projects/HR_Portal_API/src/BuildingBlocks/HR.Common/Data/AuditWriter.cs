using System.Text.Json;
using System.Text.RegularExpressions;
using HR.Common.Common;
using HR.Common.Security;
using Microsoft.EntityFrameworkCore;

namespace HR.Common.Data;

/// <summary>Append-only business audit trail written to the existing audit_history table (in the caller's transaction).</summary>
public interface IAuditWriter
{
    Task WriteAsync(string entityType, string entityId, string action, object? previous = null, object? current = null);
    Task<List<AuditRecord>> TrailAsync(string? entityType, string? entityId, int limit = 100, CancellationToken ct = default);
}

public sealed record AuditRecord(string Id, string EntityType, string EntityId, string Action, string? PreviousValue, string? NewValue, string? UserId, string? CorrelationId, DateTime CreatedAt);

public sealed partial class AuditWriter(DbContext db, ICurrentUser user) : IAuditWriter
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web) { Converters = { new System.Text.Json.Serialization.JsonStringEnumConverter() } };

    [GeneratedRegex("password|account_?number|pan_?number|national_?id|token|secret|ifsc", RegexOptions.IgnoreCase)]
    private static partial Regex SensitiveName();

    public async Task WriteAsync(string entityType, string entityId, string action, object? previous = null, object? current = null)
    {
        var id = Guid.NewGuid().ToString();
        var prev = previous is null ? null : Mask(previous);
        var next = current is null ? null : Mask(current);
        var uid = user.UserId;
        var cid = CorrelationContext.Id;
        await db.Database.ExecuteSqlInterpolatedAsync(
            $"INSERT INTO audit_history (id, action, correlation_id, created_at, entity_id, entity_type, new_value, previous_value, user_id) VALUES ({id}, {action}, {cid}, UTC_TIMESTAMP(6), {entityId}, {entityType}, {next}, {prev}, {uid})");
    }

    public async Task<List<AuditRecord>> TrailAsync(string? entityType, string? entityId, int limit = 100, CancellationToken ct = default)
    {
        limit = Math.Clamp(limit, 1, 500);
        var q = db.Database.SqlQuery<AuditRow>($"""
            SELECT id AS Id, entity_type AS EntityType, entity_id AS EntityId, action AS Action, previous_value AS PreviousValue, new_value AS NewValue,
                   user_id AS UserId, correlation_id AS CorrelationId, created_at AS CreatedAt
            FROM audit_history
            WHERE ({entityType} IS NULL OR entity_type = {entityType}) AND ({entityId} IS NULL OR entity_id = {entityId})
            ORDER BY created_at DESC LIMIT {limit}
            """);
        return (await q.ToListAsync(ct)).Select(r => new AuditRecord(r.Id, r.EntityType, r.EntityId, r.Action, r.PreviousValue, r.NewValue, r.UserId, r.CorrelationId, DateTime.SpecifyKind(r.CreatedAt, DateTimeKind.Utc))).ToList();
    }

    private sealed class AuditRow
    {
        public string Id { get; set; } = ""; public string EntityType { get; set; } = ""; public string EntityId { get; set; } = ""; public string Action { get; set; } = "";
        public string? PreviousValue { get; set; } public string? NewValue { get; set; } public string? UserId { get; set; } public string? CorrelationId { get; set; } public DateTime CreatedAt { get; set; }
    }

    /// <summary>Serialises to JSON and masks sensitive property names so audit rows never hold secrets or bank/tax identifiers.</summary>
    private static string Mask(object value)
    {
        var node = System.Text.Json.Nodes.JsonNode.Parse(JsonSerializer.Serialize(value, Json));
        MaskNode(node);
        return node?.ToJsonString() ?? "null";
    }

    private static void MaskNode(System.Text.Json.Nodes.JsonNode? n)
    {
        switch (n)
        {
            case System.Text.Json.Nodes.JsonObject o:
                foreach (var k in o.Select(kv => kv.Key).ToList())
                    if (SensitiveName().IsMatch(k)) o[k] = "[MASKED]"; else MaskNode(o[k]);
                break;
            case System.Text.Json.Nodes.JsonArray a:
                foreach (var i in a) MaskNode(i);
                break;
        }
    }
}
