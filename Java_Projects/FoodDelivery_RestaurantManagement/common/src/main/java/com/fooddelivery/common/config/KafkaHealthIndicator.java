package com.fooddelivery.common.config;

import org.apache.kafka.clients.admin.AdminClient;
import org.springframework.boot.actuate.health.Health;
import org.springframework.boot.actuate.health.HealthIndicator;
import org.springframework.kafka.core.KafkaAdmin;
import org.springframework.stereotype.Component;

import java.util.concurrent.TimeUnit;

/** Adds a "kafka" component to /actuator/health (Spring Boot ships none) for the service-monitoring screen. */
@Component("kafka")
public class KafkaHealthIndicator implements HealthIndicator {
    private final KafkaAdmin admin;

    public KafkaHealthIndicator(KafkaAdmin admin) { this.admin = admin; }

    @Override
    public Health health() {
        try (AdminClient c = AdminClient.create(admin.getConfigurationProperties())) {
            var cluster = c.describeCluster();
            String id = cluster.clusterId().get(2, TimeUnit.SECONDS);
            int nodes = cluster.nodes().get(2, TimeUnit.SECONDS).size();
            return Health.up().withDetail("clusterId", id).withDetail("brokers", nodes).build();
        } catch (Exception e) {
            return Health.down().withDetail("error", e.getClass().getSimpleName()).build();
        }
    }
}
