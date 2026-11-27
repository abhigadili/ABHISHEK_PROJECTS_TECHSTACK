using System.Collections.Concurrent;

namespace StudentMgmt.BuildingBlocks.Common.Caching;

public interface ICacheService
{
    bool TryGet<T>(string key, out T? value);
    void Set<T>(string key, T value, TimeSpan? expiration = null);
    void Remove(string key);
}

/// <summary>
/// Registered as a Singleton — this is a correct use of Singleton because the
/// cache's entire purpose is to hold shared, process-wide state that every
/// request reads/writes; a Scoped or Transient cache would just be a dictionary
/// that resets every request and cache nothing. Contrast with
/// <see cref="StudentMgmt.BuildingBlocks.Common.Repositories.RepositoryBase{TEntity}"/>,
/// which must stay Scoped because it wraps a per-request DbContext — that is the
/// "never misuse Singleton" boundary this project is careful about.
/// </summary>
public sealed class InMemoryCacheService : ICacheService
{
    private sealed record CacheEntry(object? Value, DateTime? ExpiresAtUtc);

    private readonly ConcurrentDictionary<string, CacheEntry> _store = new();

    public bool TryGet<T>(string key, out T? value)
    {
        if (_store.TryGetValue(key, out var entry) && (entry.ExpiresAtUtc is null || entry.ExpiresAtUtc > DateTime.UtcNow))
        {
            value = (T?)entry.Value;
            return true;
        }

        _store.TryRemove(key, out _);
        value = default;
        return false;
    }

    public void Set<T>(string key, T value, TimeSpan? expiration = null)
    {
        var expiresAtUtc = expiration.HasValue ? DateTime.UtcNow.Add(expiration.Value) : (DateTime?)null;
        _store[key] = new CacheEntry(value, expiresAtUtc);
    }

    public void Remove(string key) => _store.TryRemove(key, out _);
}
