using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Logging;

namespace HMS.Shared.Cache;

/// <summary>Thin JSON layer over IDistributedCache (Redis). A Redis outage never breaks a request: errors are logged and the factory is used.</summary>
public interface ICacheService
{
    Task<T?> GetOrCreateAsync<T>(string key, Func<CancellationToken, Task<T?>> factory, TimeSpan ttl, CancellationToken ct = default) where T : class;
    Task SetAsync<T>(string key, T value, TimeSpan ttl, CancellationToken ct = default) where T : class;
    Task RemoveAsync(string key, CancellationToken ct = default);
    Task RemoveManyAsync(IEnumerable<string> keys, CancellationToken ct = default);
}

public sealed class RedisCacheService(IDistributedCache cache, ILogger<RedisCacheService> log) : ICacheService
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web) { Converters = { new JsonStringEnumConverter()  , new HMS.Shared.Common.FlexibleTimeOnlyConverter() } };

    public async Task<T?> GetOrCreateAsync<T>(string key, Func<CancellationToken, Task<T?>> factory, TimeSpan ttl, CancellationToken ct = default) where T : class
    {
        try
        {
            var bytes = await cache.GetAsync(key, ct);
            if (bytes is not null)
            {
                log.LogDebug("Cache hit {Key}", key);
                return JsonSerializer.Deserialize<T>(bytes, Json);
            }
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            log.LogWarning("Cache GET failed for {Key}: {Error}", key, ex.GetType().Name);
        }
        var value = await factory(ct);
        if (value is not null) await SetAsync(key, value, ttl, ct);
        return value;
    }

    public async Task SetAsync<T>(string key, T value, TimeSpan ttl, CancellationToken ct = default) where T : class
    {
        try
        {
            await cache.SetAsync(key, JsonSerializer.SerializeToUtf8Bytes(value, Json),
                new DistributedCacheEntryOptions { AbsoluteExpirationRelativeToNow = ttl }, ct);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            log.LogWarning("Cache SET failed for {Key}: {Error}", key, ex.GetType().Name);
        }
    }

    public async Task RemoveAsync(string key, CancellationToken ct = default)
    {
        try { await cache.RemoveAsync(key, ct); }
        catch (Exception ex) when (ex is not OperationCanceledException) { log.LogWarning("Cache REMOVE failed for {Key}: {Error}", key, ex.GetType().Name); }
    }

    public async Task RemoveManyAsync(IEnumerable<string> keys, CancellationToken ct = default)
    {
        foreach (var k in keys) await RemoveAsync(k, ct);
    }
}
