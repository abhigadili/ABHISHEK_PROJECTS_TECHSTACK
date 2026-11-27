package com.fooddelivery.common.cache;

import com.fasterxml.jackson.annotation.JsonTypeInfo;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.databind.jsontype.impl.LaissezFaireSubTypeValidator;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.cache.Cache;
import org.springframework.cache.annotation.CachingConfigurer;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.cache.interceptor.CacheErrorHandler;
import org.springframework.cache.interceptor.SimpleCacheErrorHandler;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.cache.RedisCacheConfiguration;
import org.springframework.data.redis.cache.RedisCacheManager;
import org.springframework.data.redis.cache.RedisCacheWriter;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.serializer.GenericJackson2JsonRedisSerializer;
import org.springframework.data.redis.serializer.RedisSerializationContext;
import org.springframework.data.redis.serializer.StringRedisSerializer;

import java.time.Duration;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.Callable;

/**
 * Redis cache abstraction ({@code @Cacheable/@CachePut/@CacheEvict}).
 * Keys: "food:&lt;cacheName&gt;::&lt;key&gt;". Values: typed JSON. TTL per cache from {@code food.cache.ttls.*}.
 * A broken Redis never breaks a request: errors are logged and the call falls through to the database.
 * Hit/miss logging is done by {@link LoggingCache}.
 */
@Configuration
@EnableCaching
@EnableConfigurationProperties(CacheConfig.CacheProps.class)
public class CacheConfig implements CachingConfigurer {
    private static final Logger log = LoggerFactory.getLogger(CacheConfig.class);

    @ConfigurationProperties(prefix = "food.cache")
    public record CacheProps(Duration defaultTtl, Map<String, Duration> ttls) {
        public CacheProps {
            if (defaultTtl == null) defaultTtl = Duration.ofMinutes(10);
            if (ttls == null) ttls = Map.of();
        }
    }

    @Bean
    public RedisCacheManager cacheManager(RedisConnectionFactory cf, CacheProps props) {
        ObjectMapper om = new ObjectMapper();
        om.registerModule(new JavaTimeModule());
        om.disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
        om.disable(com.fasterxml.jackson.databind.DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES);
        om.activateDefaultTyping(LaissezFaireSubTypeValidator.instance, ObjectMapper.DefaultTyping.EVERYTHING, JsonTypeInfo.As.PROPERTY);
        RedisCacheConfiguration base = RedisCacheConfiguration.defaultCacheConfig()
                .entryTtl(props.defaultTtl()).disableCachingNullValues()
                .computePrefixWith(name -> "food:" + name + "::")
                .serializeKeysWith(RedisSerializationContext.SerializationPair.fromSerializer(new StringRedisSerializer()))
                .serializeValuesWith(RedisSerializationContext.SerializationPair.fromSerializer(new GenericJackson2JsonRedisSerializer(om)));
        Map<String, RedisCacheConfiguration> perCache = new HashMap<>();
        props.ttls().forEach((name, ttl) -> perCache.put(name, base.entryTtl(ttl)));
        return new RedisCacheManager(RedisCacheWriter.nonLockingRedisCacheWriter(cf), base, perCache) {
            @Override protected Cache decorateCache(Cache cache) { return new LoggingCache(cache); }
        };
    }

    @Override
    public CacheErrorHandler errorHandler() {
        return new SimpleCacheErrorHandler() {
            @Override public void handleCacheGetError(RuntimeException e, Cache c, Object k) { log.warn("Cache GET failed [{}] {}: {}", c.getName(), k, e.getMessage()); }
            @Override public void handleCachePutError(RuntimeException e, Cache c, Object k, Object v) { log.warn("Cache PUT failed [{}] {}: {}", c.getName(), k, e.getMessage()); }
            @Override public void handleCacheEvictError(RuntimeException e, Cache c, Object k) { log.warn("Cache EVICT failed [{}] {}: {}", c.getName(), k, e.getMessage()); }
            @Override public void handleCacheClearError(RuntimeException e, Cache c) { log.warn("Cache CLEAR failed [{}]: {}", c.getName(), e.getMessage()); }
        };
    }

    /** Decorator that logs every cache hit and miss (visible in Kibana as "Redis cache activity"). */
    static class LoggingCache implements Cache {
        private static final Logger clog = LoggerFactory.getLogger("cache");
        private final Cache delegate;
        LoggingCache(Cache delegate) { this.delegate = delegate; }
        @Override public String getName() { return delegate.getName(); }
        @Override public Object getNativeCache() { return delegate.getNativeCache(); }
        @Override public ValueWrapper get(Object key) {
            ValueWrapper w = delegate.get(key);
            clog.info("Redis cache {} cache={} key={}", w == null ? "MISS" : "HIT", getName(), key);
            return w;
        }
        @Override public <T> T get(Object key, Class<T> type) { return delegate.get(key, type); }
        @Override public <T> T get(Object key, Callable<T> valueLoader) { return delegate.get(key, valueLoader); }
        @Override public void put(Object key, Object value) { clog.info("Redis cache PUT cache={} key={}", getName(), key); delegate.put(key, value); }
        @Override public ValueWrapper putIfAbsent(Object key, Object value) { return delegate.putIfAbsent(key, value); }
        @Override public void evict(Object key) { clog.info("Redis cache EVICT cache={} key={}", getName(), key); delegate.evict(key); }
        @Override public boolean evictIfPresent(Object key) { return delegate.evictIfPresent(key); }
        @Override public void clear() { clog.info("Redis cache CLEAR cache={}", getName()); delegate.clear(); }
        @Override public boolean invalidate() { return delegate.invalidate(); }
    }
}
