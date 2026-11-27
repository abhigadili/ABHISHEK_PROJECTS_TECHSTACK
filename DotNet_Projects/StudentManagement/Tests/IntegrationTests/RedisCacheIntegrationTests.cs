using Common.Caching;
using Microsoft.Extensions.Caching.StackExchangeRedis;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using StackExchange.Redis;

namespace IntegrationTests;

/// <summary>Redis integration: cache-aside, expiration, invalidation, update-on-change and graceful degradation when Redis is down.</summary>
[Collection("infra")]
public class RedisCacheIntegrationTests(InfraFixture infra)
{
    private ICacheService Cache(string? conn = null) => new RedisCacheService(
        new RedisCache(Options.Create(new RedisCacheOptions { Configuration = (conn ?? infra.Redis.GetConnectionString()) + ",abortConnect=false,connectTimeout=500,syncTimeout=500", InstanceName = "it:" })),
        NullLogger<RedisCacheService>.Instance);

    private record Dto(long Id, string Name);

    [Fact]
    public async Task GetOrSet_loads_once_then_serves_from_redis()
    {
        var cache = Cache(); var calls = 0; var key = "k-" + Guid.NewGuid();
        Task<Dto?> Loader() { calls++; return Task.FromResult<Dto?>(new Dto(1, "Asha")); }
        Assert.Equal("Asha", (await cache.GetOrSetAsync(key, TimeSpan.FromMinutes(1), Loader))!.Name);
        Assert.Equal("Asha", (await cache.GetOrSetAsync(key, TimeSpan.FromMinutes(1), Loader))!.Name);
        Assert.Equal(1, calls);
        using var mux = await ConnectionMultiplexer.ConnectAsync(infra.Redis.GetConnectionString());
        Assert.True(await mux.GetDatabase().KeyExistsAsync("it:" + key));            // the value really lives in Redis (key prefix applied)
    }

    [Fact]
    public async Task Entries_expire_after_their_ttl()
    {
        var cache = Cache(); var key = "ttl-" + Guid.NewGuid();
        await cache.SetAsync(key, new Dto(2, "x"), TimeSpan.FromSeconds(1));
        Assert.NotNull(await cache.GetAsync<Dto>(key));
        await Task.Delay(1600);
        Assert.Null(await cache.GetAsync<Dto>(key));
    }

    [Fact]
    public async Task Invalidation_and_update_on_change()
    {
        var cache = Cache(); var key = "inv-" + Guid.NewGuid();
        await cache.SetAsync(key, new Dto(3, "old"), TimeSpan.FromMinutes(1));
        await cache.SetAsync(key, new Dto(3, "new"), TimeSpan.FromMinutes(1));          // cache update (what Student update does)
        Assert.Equal("new", (await cache.GetAsync<Dto>(key))!.Name);
        await cache.RemoveAsync(key);                                                     // invalidation (what delete does)
        Assert.Null(await cache.GetAsync<Dto>(key));
    }

    [Fact]
    public async Task Null_loader_results_are_not_cached()
    {
        var cache = Cache(); var key = "nul-" + Guid.NewGuid(); var calls = 0;
        Task<Dto?> Loader() { calls++; return Task.FromResult<Dto?>(null); }
        Assert.Null(await cache.GetOrSetAsync(key, TimeSpan.FromMinutes(1), Loader));
        Assert.Null(await cache.GetOrSetAsync(key, TimeSpan.FromMinutes(1), Loader));
        Assert.Equal(2, calls);
    }

    [Fact]
    public async Task When_redis_is_unreachable_the_loader_result_is_still_returned()
    {
        var cache = Cache("127.0.0.1:1");                                               // nothing listens here
        var r = await cache.GetOrSetAsync("x", TimeSpan.FromMinutes(1), () => Task.FromResult<Dto?>(new Dto(9, "from-db")));
        Assert.Equal("from-db", r!.Name);                                                 // the cache is an optimisation, never a dependency
        await cache.RemoveAsync("x");                                                     // does not throw
    }
}
