using System.Text.Json;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Logging;
using StackExchange.Redis;

namespace HR.Common.Cache;

/// <summary>Low-level Redis operations (StackExchange.Redis): strings, rate limiting, distributed locks, key scans.</summary>
public interface IRedisService
{
    Task<string?> GetStringAsync(string key);
    Task SetStringAsync(string key, string value, TimeSpan ttl);
    Task<bool> SetIfAbsentAsync(string key, string value, TimeSpan ttl);
    Task<bool> DeleteAsync(string key);
    Task<long> DeleteByPrefixAsync(string prefix);
    /// <summary>Fixed-window counter: returns the new count for the window (fails open: 0 on Redis outage).</summary>
    Task<long> IncrementWindowAsync(string key, TimeSpan window);
    Task<long> IncrementAsync(string key, TimeSpan ttl);
    Task<IAsyncDisposable?> TryLockAsync(string resource, TimeSpan ttl);
    Task<string?> PingAsync();
}

public sealed class RedisService(IConnectionMultiplexer mux, ILogger<RedisService> log) : IRedisService
{
    private IDatabase Db => mux.GetDatabase();
    private const string ReleaseScript = "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end";

    public async Task<string?> GetStringAsync(string key)
    {
        try { var v = await Db.StringGetAsync(key); return v.HasValue ? (string?)v : null; }
        catch (RedisException ex) { log.LogWarning("Redis GET {Key} failed: {Error}", key, ex.Message); return null; }
    }

    public async Task SetStringAsync(string key, string value, TimeSpan ttl)
    {
        try { await Db.StringSetAsync(key, value, ttl); }
        catch (RedisException ex) { log.LogWarning("Redis SET {Key} failed: {Error}", key, ex.Message); }
    }

    public async Task<bool> SetIfAbsentAsync(string key, string value, TimeSpan ttl)
    {
        try { return await Db.StringSetAsync(key, value, ttl, When.NotExists); }
        catch (RedisException ex) { log.LogWarning("Redis SETNX {Key} failed: {Error}", key, ex.Message); return true; }
    }

    public async Task<bool> DeleteAsync(string key)
    {
        try { return await Db.KeyDeleteAsync(key); }
        catch (RedisException ex) { log.LogWarning("Redis DEL {Key} failed: {Error}", key, ex.Message); return false; }
    }

    public async Task<long> DeleteByPrefixAsync(string prefix)
    {
        long n = 0;
        try
        {
            foreach (var ep in mux.GetEndPoints())
            {
                var server = mux.GetServer(ep);
                if (server.IsReplica) continue;
                var keys = server.KeysAsync(pattern: prefix + "*", pageSize: 250);
                await foreach (var k in keys) if (await Db.KeyDeleteAsync(k)) n++;
            }
        }
        catch (RedisException ex) { log.LogWarning("Redis prefix delete {Prefix} failed: {Error}", prefix, ex.Message); }
        return n;
    }

    public async Task<long> IncrementWindowAsync(string key, TimeSpan window) => await IncrementAsync(key, window);

    public async Task<long> IncrementAsync(string key, TimeSpan ttl)
    {
        try
        {
            var n = await Db.StringIncrementAsync(key);
            if (n == 1) await Db.KeyExpireAsync(key, ttl);
            return n;
        }
        catch (RedisException ex) { log.LogWarning("Redis INCR {Key} failed: {Error}", key, ex.Message); return 0; }
    }

    public async Task<IAsyncDisposable?> TryLockAsync(string resource, TimeSpan ttl)
    {
        var key = "lock:" + resource;
        var token = Guid.NewGuid().ToString("N");
        bool acquired;
        try { acquired = await Db.StringSetAsync(key, token, ttl, When.NotExists); }
        catch (RedisException ex) { throw new Common.DependencyUnavailableException("Distributed lock unavailable: " + ex.Message); }
        return acquired ? new Lock(Db, key, token) : null;
    }

    public async Task<string?> PingAsync()
    {
        try { return (await Db.PingAsync()).TotalMilliseconds.ToString("0.0") + " ms"; } catch (RedisException) { return null; }
    }

    private sealed class Lock(IDatabase db, string key, string token) : IAsyncDisposable
    {
        public async ValueTask DisposeAsync()
        {
            try { await db.ScriptEvaluateAsync(ReleaseScript, [(RedisKey)key], [(RedisValue)token]); } catch (RedisException) { /* lock expires by TTL */ }
        }
    }
}

/// <summary>Cache-aside JSON cache on IDistributedCache. A Redis outage never breaks a request.</summary>
public interface ICacheService
{
    Task<T?> GetOrCreateAsync<T>(string key, Func<CancellationToken, Task<T?>> factory, TimeSpan ttl, CancellationToken ct = default) where T : class;
    Task<T?> GetAsync<T>(string key, CancellationToken ct = default) where T : class;
    Task SetAsync<T>(string key, T value, TimeSpan ttl, CancellationToken ct = default) where T : class;
    Task RemoveAsync(string key, CancellationToken ct = default);
    /// <summary>Evicts every key whose logical name starts with the prefix (e.g. "employee:directory:").</summary>
    Task EvictPrefixAsync(string prefix);
}

public sealed class RedisCacheService(IDistributedCache cache, IRedisService redis, Microsoft.Extensions.Configuration.IConfiguration cfg, ILogger<RedisCacheService> log) : ICacheService
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web) { Converters = { new System.Text.Json.Serialization.JsonStringEnumConverter() } };
    private string InstancePrefix => $"hr:{cfg["Service:Name"] ?? "svc"}:";

    public async Task<T?> GetOrCreateAsync<T>(string key, Func<CancellationToken, Task<T?>> factory, TimeSpan ttl, CancellationToken ct = default) where T : class
    {
        try
        {
            var bytes = await cache.GetAsync(key, ct);
            if (bytes is not null) { log.LogDebug("Cache HIT {Key}", key); return JsonSerializer.Deserialize<T>(bytes, Json); }
        }
        catch (Exception ex) when (ex is not OperationCanceledException) { log.LogWarning("Cache GET {Key} failed: {Error}", key, ex.GetType().Name); }
        var value = await factory(ct);
        if (value is not null)
        {
            try { await cache.SetAsync(key, JsonSerializer.SerializeToUtf8Bytes(value, Json), new DistributedCacheEntryOptions { AbsoluteExpirationRelativeToNow = ttl }, ct); }
            catch (Exception ex) when (ex is not OperationCanceledException) { log.LogWarning("Cache SET {Key} failed: {Error}", key, ex.GetType().Name); }
        }
        return value;
    }

    public async Task<T?> GetAsync<T>(string key, CancellationToken ct = default) where T : class
    {
        try { var bytes = await cache.GetAsync(key, ct); return bytes is null ? null : JsonSerializer.Deserialize<T>(bytes, Json); }
        catch (Exception ex) when (ex is not OperationCanceledException) { log.LogWarning("Cache GET {Key} failed: {Error}", key, ex.GetType().Name); return null; }
    }

    public async Task SetAsync<T>(string key, T value, TimeSpan ttl, CancellationToken ct = default) where T : class
    {
        try { await cache.SetAsync(key, JsonSerializer.SerializeToUtf8Bytes(value, Json), new DistributedCacheEntryOptions { AbsoluteExpirationRelativeToNow = ttl }, ct); }
        catch (Exception ex) when (ex is not OperationCanceledException) { log.LogWarning("Cache SET {Key} failed: {Error}", key, ex.GetType().Name); }
    }

    public async Task RemoveAsync(string key, CancellationToken ct = default)
    {
        try { await cache.RemoveAsync(key, ct); } catch (Exception ex) when (ex is not OperationCanceledException) { log.LogWarning("Cache REMOVE {Key} failed: {Error}", key, ex.GetType().Name); }
    }

    public async Task EvictPrefixAsync(string prefix) => await redis.DeleteByPrefixAsync(InstancePrefix + prefix);
}
