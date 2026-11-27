package com.fooddelivery.eventaudit.web;

import com.fooddelivery.eventaudit.monitor.KafkaMonitorService;
import com.fooddelivery.eventaudit.service.ReplayService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/** Kafka topic / message / consumer-group monitoring (ADMIN + PERM_KAFKA_MONITOR). Read-only except the guarded test publish. */
@RestController
@RequestMapping("/api/kafka")
@PreAuthorize("hasAuthority('PERM_KAFKA_MONITOR')")
@Tag(name = "Kafka Monitoring")
public class KafkaController {
    private final KafkaMonitorService kafka;
    private final ReplayService replay;

    public KafkaController(KafkaMonitorService kafka, ReplayService replay) {
        this.kafka = kafka;
        this.replay = replay;
    }

    @GetMapping("/cluster")
    public Dtos.ClusterInfo cluster() { return kafka.cluster(); }

    @Operation(summary = "All topics with partitions, replication, retention, producers, consumers and consumer groups (from the real broker)")
    @GetMapping("/topics")
    public List<Dtos.TopicSummary> topics() { return kafka.topics(); }

    @GetMapping("/topics/{topic}")
    public Dtos.TopicDetail topic(@PathVariable String topic) { return kafka.topic(topic); }

    @Operation(summary = "Messages read straight from the broker (latest N, or from an offset on one partition). Payloads are masked.")
    @GetMapping("/topics/{topic}/messages")
    public List<Dtos.KafkaMessage> messages(@PathVariable String topic, @RequestParam(required = false) Integer partition, @RequestParam(required = false) Long offset,
                                            @RequestParam(defaultValue = "50") int limit) {
        return kafka.messages(topic, partition, offset, limit);
    }

    @GetMapping("/groups")
    public List<Dtos.GroupInfo> groups() { return kafka.groups(); }

    @Operation(summary = "Producer -> topic -> consumer graph built from the topology the services announced")
    @GetMapping("/flow")
    public Dtos.Flow flow() { return kafka.flow(); }

    @GetMapping("/dead-letters")
    public List<Dtos.TopicSummary> deadLetters() { return kafka.topics().stream().filter(Dtos.TopicSummary::deadLetter).toList(); }

    @PostMapping("/publish-test")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public Map<String, String> publishTest(@RequestParam(defaultValue = "notification.requested") String topic, @Valid @RequestBody Dtos.PublishTestRequest r) {
        return Map.of("eventId", replay.publishTest(topic, r), "topic", topic, "note", "Queued in the outbox; it will appear in the audit history within seconds");
    }
}
