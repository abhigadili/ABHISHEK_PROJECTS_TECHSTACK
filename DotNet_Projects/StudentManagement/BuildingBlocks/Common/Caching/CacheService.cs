using System.Text.Json;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Logging;

namespace Common.Caching;

public interface ICacheService
{
    Task<T?> GetAsync<T>(string key, CancellationToken ct = default);
    Task SetAsync<T>(string key, T value, TimeSpan ttl, CancellationToken ct = default);
    Task RemoveAsync(string key, CancellationToken ct = default);
    /// <summary>Cache-aside: return the cached value or load + cache it. Redis failures are logged and the loader result is returned (the cache is an optimisation, never a dependency).</summary>
    Task<T?> GetOrSetAsync<T>(string key, TimeSpan ttl, Func<Task<T?>> loader, CancellationToken ct = default);
}

public class RedisCacheService(IDistributedCache cache, ILogger<RedisCacheService> log) : ICacheService
{
    // enums as strings: readable in redis-cli and safe if an enum is ever reordered
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web) { Converters = { new System.Text.Json.Serialization.JsonStringEnumConverter() } };

    public async Task<T?> GetAsync<T>(string key, CancellationToken ct = default)
    {
        try
        {
            var s = await cache.GetStringAsync(key, ct);
            return s is null ? default : JsonSerializer.Deserialize<T>(s, Json);
        }
        catch (Exception e) { log.LogWarning("Cache GET failed [{Key}]: {Msg}", key, e.Message); return default; }
    }

    public async Task SetAsync<T>(string key, T value, TimeSpan ttl, CancellationToken ct = default)
    {
        try
        {
            await cache.SetStringAsync(key, JsonSerializer.Serialize(value, Json),
                new DistributedCacheEntryOptions { AbsoluteExpirationRelativeToNow = ttl }, ct);
        }
        catch (Exception e) { log.LogWarning("Cache SET failed [{Key}]: {Msg}", key, e.Message); }
    }

    public async Task RemoveAsync(string key, CancellationToken ct = default)
    {
        try { await cache.RemoveAsync(key, ct); }
        catch (Exception e) { log.LogWarning("Cache REMOVE failed [{Key}]: {Msg}", key, e.Message); }
    }

    public async Task<T?> GetOrSetAsync<T>(string key, TimeSpan ttl, Func<Task<T?>> loader, CancellationToken ct = default)
    {
        var hit = await GetAsync<T>(key, ct);
        if (hit is not null) return hit;
        var value = await loader();
        if (value is not null) await SetAsync(key, value, ttl, ct);
        return value;
    }
}
