package com.example.course.config;

import com.example.course.dto.CourseAvailabilityResponse;
import com.example.course.dto.CourseResponse;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import java.time.Duration;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cache.Cache;
import org.springframework.cache.annotation.CachingConfigurer;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.cache.interceptor.CacheErrorHandler;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.cache.RedisCacheConfiguration;
import org.springframework.data.redis.cache.RedisCacheManager;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.serializer.Jackson2JsonRedisSerializer;
import org.springframework.data.redis.serializer.RedisSerializationContext.SerializationPair;
import org.springframework.data.redis.serializer.StringRedisSerializer;

@Configuration
@EnableCaching
public class CacheConfig implements CachingConfigurer {
    private static final Logger log = LoggerFactory.getLogger(CacheConfig.class);

    @Bean
    RedisCacheManager cacheManager(RedisConnectionFactory cf, @Value("${app.cache.course-ttl:10m}") Duration courseTtl,
                                   @Value("${app.cache.availability-ttl:1m}") Duration availabilityTtl) {
        ObjectMapper om = new ObjectMapper().registerModule(new JavaTimeModule())
                .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
        RedisCacheConfiguration base = RedisCacheConfiguration.defaultCacheConfig().prefixCacheNameWith("sms:")
                .disableCachingNullValues().serializeKeysWith(SerializationPair.fromSerializer(new StringRedisSerializer()));
        return RedisCacheManager.builder(cf).withInitialCacheConfigurations(Map.of(
                CourseCacheEvictor.COURSES, base.entryTtl(courseTtl).serializeValuesWith(
                        SerializationPair.fromSerializer(new Jackson2JsonRedisSerializer<>(om, CourseResponse.class))),
                CourseCacheEvictor.AVAILABILITY, base.entryTtl(availabilityTtl).serializeValuesWith(
                        SerializationPair.fromSerializer(new Jackson2JsonRedisSerializer<>(om, CourseAvailabilityResponse.class)))
        )).build();
    }

    @Override
    public CacheErrorHandler errorHandler() {
        return new CacheErrorHandler() {
            public void handleCacheGetError(RuntimeException e, Cache c, Object k) { log.warn("Cache GET failed [{}:{}]: {}", c.getName(), k, e.getMessage()); }
            public void handleCachePutError(RuntimeException e, Cache c, Object k, Object v) { log.warn("Cache PUT failed [{}:{}]: {}", c.getName(), k, e.getMessage()); }
            public void handleCacheEvictError(RuntimeException e, Cache c, Object k) { log.warn("Cache EVICT failed [{}:{}]: {}", c.getName(), k, e.getMessage()); }
            public void handleCacheClearError(RuntimeException e, Cache c) { log.warn("Cache CLEAR failed [{}]: {}", c.getName(), e.getMessage()); }
        };
    }
}
