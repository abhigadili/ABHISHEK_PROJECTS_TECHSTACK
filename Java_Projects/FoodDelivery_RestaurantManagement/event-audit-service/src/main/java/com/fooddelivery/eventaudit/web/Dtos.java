package com.fooddelivery.eventaudit.web;

import com.fooddelivery.eventaudit.domain.EventAudit;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.List;
import java.util.Map;

public final class Dtos {
    private Dtos() {}

    public record AuditDto(Long id, String role, String eventId, String topic, Integer partition, Long offset, String key, String eventType, String producerService,
                           String consumerService, String consumerGroup, String consumerClass, Instant eventTimestamp, Instant processedAt, String status,
                           Integer attempts, Long durationMs, String error, String correlationId, String payload, String headers, int replayCount) {
        public static AuditDto from(EventAudit a) {
            return new AuditDto(a.getId(), a.getRole(), a.getEventId(), a.getTopic(), a.getPartitionNo(), a.getOffsetNo(), a.getMsgKey(), a.getEventType(), a.getProducerService(),
                    a.getConsumerService(), a.getConsumerGroup(), a.getConsumerClass(), a.getEventTimestamp(), a.getProcessedAt(), a.getStatus(), a.getAttempts(), a.getDurationMs(),
                    a.getErrorDetails(), a.getCorrelationId(), a.getPayloadMasked(), a.getHeadersJson(), a.getReplayCount());
        }
    }

    public record AuditStats(long published, Map<String, Long> consumedByStatus, Map<String, Long> publishedPerTopic) {}
    public record PublishTestRequest(@NotNull Long userId, @NotBlank @Size(max = 150) String title, @NotBlank @Size(max = 500) String message) {}
    public record ReplayResult(boolean replayed, String message, int replayCount) {}

    // ---- Kafka monitoring
    public record PartitionInfo(int partition, int leader, List<Integer> replicas, List<Integer> isr, long beginOffset, long endOffset) {}
    public record TopicSummary(String name, String description, int partitions, int replicationFactor, Map<String, String> config, long messageCount,
                               List<String> producers, List<String> consumers, List<String> consumerGroups, String status, boolean deadLetter) {}
    public record TopicDetail(TopicSummary summary, List<PartitionInfo> partitionDetails, List<TopologyDto> topology) {}
    public record TopologyDto(String service, String role, String topic, String groupId, String className, String method) {}
    public record KafkaMessage(String topic, int partition, long offset, String key, Instant timestamp, Map<String, String> headers, String eventId, String eventType,
                               String producerService, String correlationId, String value, boolean masked) {}
    public record GroupMember(String clientId, String host, List<String> assignment) {}
    public record GroupTopicLag(String topic, int partition, long currentOffset, long logEndOffset, long lag, String memberClientId) {}
    public record GroupInfo(String groupId, String state, String coordinator, String partitionAssignor, List<String> topics, List<GroupMember> members,
                            List<GroupTopicLag> offsets, long totalLag) {}
    public record FlowNode(String id, String type, String label) {}
    public record FlowEdge(String from, String to, String via, String className) {}
    public record Flow(List<FlowNode> nodes, List<FlowEdge> edges) {}
    public record ClusterInfo(String clusterId, int brokers, String controller, List<String> brokerAddresses) {}
}
