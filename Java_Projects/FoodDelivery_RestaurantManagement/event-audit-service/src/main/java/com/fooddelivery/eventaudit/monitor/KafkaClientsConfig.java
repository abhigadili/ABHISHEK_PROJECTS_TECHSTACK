package com.fooddelivery.eventaudit.monitor;

import org.apache.kafka.clients.admin.AdminClient;
import org.apache.kafka.clients.admin.AdminClientConfig;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.core.KafkaAdmin;

import java.util.HashMap;
import java.util.Map;

@Configuration
public class KafkaClientsConfig {
    /** One shared AdminClient for the monitoring API (real broker metadata: topics, configs, groups, offsets). */
    @Bean(destroyMethod = "close")
    public AdminClient monitoringAdminClient(KafkaAdmin admin) {
        Map<String, Object> props = new HashMap<>(admin.getConfigurationProperties());
        props.put(AdminClientConfig.REQUEST_TIMEOUT_MS_CONFIG, 5000);
        props.put(AdminClientConfig.DEFAULT_API_TIMEOUT_MS_CONFIG, 8000);
        props.put(AdminClientConfig.CLIENT_ID_CONFIG, "food-monitoring-admin");
        return AdminClient.create(props);
    }
}
