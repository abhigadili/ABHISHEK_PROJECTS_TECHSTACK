package com.hrportal.notification.service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Properties;
import java.util.Set;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

import org.apache.kafka.clients.admin.AdminClient;
import org.apache.kafka.clients.admin.TopicDescription;
import org.apache.kafka.clients.consumer.KafkaConsumer;
import org.apache.kafka.common.TopicPartition;
import org.apache.kafka.common.serialization.StringDeserializer;
import org.springframework.kafka.core.KafkaAdmin;
import org.springframework.stereotype.Service;

import com.hrportal.common.events.Topics;
import com.hrportal.common.exception.ServiceUnavailableException;
import com.hrportal.notification.dto.NotificationDtos.KafkaOverview;
import com.hrportal.notification.dto.NotificationDtos.TopicInfo;

/** Read-only Kafka topic information (partitions, message counts per topic incl. retry / dead-letter topics) - an API, not a monitoring dashboard. */
@Service
public class KafkaInfoService {
    private final KafkaAdmin admin;

    public KafkaInfoService(KafkaAdmin admin) {
        this.admin = admin;
    }

    public KafkaOverview overview() {
        Map<String, Object> cfg = new HashMap<>(admin.getConfigurationProperties());
        cfg.put("request.timeout.ms", "5000");
        cfg.put("default.api.timeout.ms", "8000");
        try (AdminClient client = AdminClient.create(cfg)) {
            Set<String> names = client.listTopics().names().get(8, TimeUnit.SECONDS).stream()
                    .filter(n -> Topics.ALL.stream().anyMatch(t -> n.equals(t) || n.startsWith(t + ".") || n.startsWith(t + "-"))).collect(Collectors.toSet());
            Map<String, TopicDescription> described = client.describeTopics(names).allTopicNames().get(8, TimeUnit.SECONDS);
            Properties cp = new Properties();
            cfg.forEach((k, v) -> {
                if ("bootstrap.servers".equals(k)) cp.put(k, v);
            });
            cp.put("key.deserializer", StringDeserializer.class.getName());
            cp.put("value.deserializer", StringDeserializer.class.getName());
            cp.put("group.id", "hr-notification-info-" + System.nanoTime());
            Map<String, Long> counts = new HashMap<>();
            try (KafkaConsumer<String, String> consumer = new KafkaConsumer<>(cp)) {
                List<TopicPartition> all = new ArrayList<>();
                described.values().forEach(d -> d.partitions().forEach(p -> all.add(new TopicPartition(d.name(), p.partition()))));
                Map<TopicPartition, Long> end = consumer.endOffsets(all);
                Map<TopicPartition, Long> begin = consumer.beginningOffsets(all);
                end.forEach((tp, e) -> counts.merge(tp.topic(), e - begin.getOrDefault(tp, 0L), Long::sum));
            }
            List<TopicInfo> topics = described.values().stream().map(d -> new TopicInfo(d.name(), d.partitions().size(), counts.getOrDefault(d.name(), 0L),
                    d.name().endsWith(".DLT") || d.name().endsWith("-dlt"))).sorted(Comparator.comparing(TopicInfo::topic)).toList();
            return new KafkaOverview(String.valueOf(cfg.get("bootstrap.servers")), topics.size(), topics);
        } catch (Exception e) {
            if (e instanceof InterruptedException) Thread.currentThread().interrupt();
            throw new ServiceUnavailableException("Kafka is not reachable: " + e.getClass().getSimpleName());
        }
    }
}
