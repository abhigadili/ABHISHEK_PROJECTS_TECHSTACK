package com.hospital.common.cache;

import java.time.Duration;
import java.util.HashMap;
import java.util.Map;

import org.springframework.boot.context.properties.ConfigurationProperties;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@ConfigurationProperties("hospital.cache")
public class HospitalCacheProperties {
    private boolean enabled;
    private Duration defaultTtl = Duration.ofMinutes(10);
    /** Per-cache TTL overrides, keyed by cache name. */
    private Map<String, Duration> ttl = new HashMap<>();
}
