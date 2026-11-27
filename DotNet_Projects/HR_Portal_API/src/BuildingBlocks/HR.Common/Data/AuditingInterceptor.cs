using HR.Common.Security;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;

namespace HR.Common.Data;

/// <summary>
/// SaveChanges interceptor (entity lifecycle hook): fills the Java-compatible base columns on every insert/update -
/// id (UUID string), created_at/by, updated_at/by and bumps the optimistic-lock "version".
/// </summary>
public sealed class AuditingInterceptor(ICurrentUserAccessor user) : SaveChangesInterceptor
{
    public override InterceptionResult<int> SavingChanges(DbContextEventData e, InterceptionResult<int> result) { Apply(e.Context); return result; }

    public override ValueTask<InterceptionResult<int>> SavingChangesAsync(DbContextEventData e, InterceptionResult<int> result, CancellationToken ct = default)
    {
        Apply(e.Context);
        return ValueTask.FromResult(result);
    }

    private void Apply(DbContext? ctx)
    {
        if (ctx is null) return;
        var now = DateTime.UtcNow;
        var actor = user.UserId ?? "system";
        foreach (var entry in ctx.ChangeTracker.Entries().Where(x => x.State is EntityState.Added or EntityState.Modified))
        {
            if (entry.Metadata.IsOwned()) continue;
            if (entry.State == EntityState.Added)
            {
                Set(entry, "Id", p => p.Metadata.ClrType == typeof(string) && string.IsNullOrEmpty((string?)p.CurrentValue), Guid.NewGuid().ToString());
                Set(entry, "CreatedAt", p => IsDateTime(p) && (p.CurrentValue is null || (DateTime)p.CurrentValue == default), now);
                Set(entry, "CreatedBy", p => p.CurrentValue is null, actor);
                Set(entry, "UpdatedAt", IsDateTime, now);
                Set(entry, "UpdatedBy", p => true, actor);
            }
            else
            {
                Set(entry, "UpdatedAt", IsDateTime, now);
                Set(entry, "UpdatedBy", p => true, actor);
                var v = entry.Properties.FirstOrDefault(p => p.Metadata.Name == "Version" && p.Metadata.ClrType == typeof(long));
                if (v is not null) v.CurrentValue = (long)v.OriginalValue! + 1;
            }
        }
    }

    private static bool IsDateTime(Microsoft.EntityFrameworkCore.ChangeTracking.PropertyEntry p) => (Nullable.GetUnderlyingType(p.Metadata.ClrType) ?? p.Metadata.ClrType) == typeof(DateTime);

    private static void Set(Microsoft.EntityFrameworkCore.ChangeTracking.EntityEntry entry, string name, Func<Microsoft.EntityFrameworkCore.ChangeTracking.PropertyEntry, bool> when, object value)
    {
        var p = entry.Properties.FirstOrDefault(x => x.Metadata.Name == name);
        if (p is not null && when(p)) p.CurrentValue = value;
    }
}

/// <summary>Who is acting right now (HTTP user or "system" in Kafka consumers/background jobs).</summary>
public interface ICurrentUserAccessor { string? UserId { get; } }

public sealed class CurrentUserAccessor(ICurrentUser user) : ICurrentUserAccessor
{
    public string? UserId => user.UserId;
}
