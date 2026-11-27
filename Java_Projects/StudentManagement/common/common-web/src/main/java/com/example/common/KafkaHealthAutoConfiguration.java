package com.example.common;

import java.util.concurrent.TimeUnit;
import org.apache.kafka.clients.admin.AdminClient;
import org.apache.kafka.clients.admin.DescribeClusterOptions;
import org.springframework.boot.actuate.health.AbstractHealthIndicator;
import org.springframework.boot.actuate.health.Health;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnClass;
import org.springframework.context.annotation.Bean;
import org.springframework.kafka.core.KafkaAdmin;

/** Adds a "kafka" health component (cluster reachability) to every service that uses spring-kafka. */
@AutoConfiguration(afterName = "org.springframework.boot.autoconfigure.kafka.KafkaAutoConfiguration")
@ConditionalOnClass({KafkaAdmin.class, AbstractHealthIndicator.class})
public class KafkaHealthAutoConfiguration {

    @Bean
    @ConditionalOnBean(KafkaAdmin.class)
    KafkaHealthIndicator kafkaHealthIndicator(KafkaAdmin admin) { return new KafkaHealthIndicator(admin); }

    static class KafkaHealthIndicator extends AbstractHealthIndicator {
        private final KafkaAdmin admin;

        KafkaHealthIndicator(KafkaAdmin admin) { super("Kafka health check failed"); this.admin = admin; }

        @Override
        protected void doHealthCheck(Health.Builder builder) throws Exception {
            try (AdminClient client = AdminClient.create(admin.getConfigurationProperties())) {
                var cluster = client.describeCluster(new DescribeClusterOptions().timeoutMs(3000));
                builder.up().withDetail("clusterId", cluster.clusterId().get(3, TimeUnit.SECONDS))
                        .withDetail("nodes", cluster.nodes().get(3, TimeUnit.SECONDS).size());
            }
        }
    }
}
