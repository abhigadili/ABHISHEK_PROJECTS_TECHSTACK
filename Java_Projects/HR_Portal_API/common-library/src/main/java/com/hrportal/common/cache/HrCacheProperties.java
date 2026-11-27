package com.hrportal.common.cache;

import java.time.Duration;
import java.util.HashMap;
import java.util.Map;

import org.springframework.boot.context.properties.ConfigurationProperties;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@ConfigurationProperties("hr.cache")
public class HrCacheProperties {
    private Duration defaultTtl = Duration.ofMinutes(10);
    /** Per-cache TTL overrides, keyed by cache name (see each service's application.yml). */
    private Map<String, Duration> ttl = new HashMap<>();
}
