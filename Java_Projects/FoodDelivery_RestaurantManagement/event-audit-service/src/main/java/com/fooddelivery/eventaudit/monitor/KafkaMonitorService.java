package com.fooddelivery.eventaudit.monitor;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.fooddelivery.common.exception.BusinessException;
import com.fooddelivery.common.exception.NotFoundException;
import com.fooddelivery.common.kafka.Topics;
import com.fooddelivery.eventaudit.domain.TopologyEdge;
import com.fooddelivery.eventaudit.repository.TopologyEdgeRepository;
import com.fooddelivery.eventaudit.service.PayloadMasker;
import com.fooddelivery.eventaudit.web.Dtos;
import org.apache.kafka.clients.admin.*;
import org.apache.kafka.clients.consumer.Consumer;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.apache.kafka.clients.consumer.ConsumerRecords;
import org.apache.kafka.clients.consumer.OffsetAndMetadata;
import org.apache.kafka.common.ConsumerGroupState;
import org.apache.kafka.common.TopicPartition;
import org.apache.kafka.common.config.ConfigResource;
import org.apache.kafka.common.header.Header;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.kafka.core.ConsumerFactory;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

/**
 * Real Kafka metadata for the dashboard, read with {@link AdminClient} and short-lived assign()-only consumers.
 * Nothing here is invented: topic configs, partition leaders/ISR, offsets, group state, assignments and lag all come from the broker.
 * Read-only by design: no delete, no offset reset.
 */
@Service
public class KafkaMonitorService {
    private static final Logger log = LoggerFactory.getLogger(KafkaMonitorService.class);
    private static final List<String> CONFIG_KEYS = List.of("retention.ms", "retention.bytes", "cleanup.policy", "max.message.bytes", "min.insync.replicas", "segment.bytes");
    private static final long T = 8;
    private final AdminClient admin;
    private final ConsumerFactory<String, String> consumers;
    private final TopologyEdgeRepository topology;
    private final PayloadMasker masker;
    private final ObjectMapper mapper;

    public KafkaMonitorService(AdminClient admin, ConsumerFactory<String, String> consumers, TopologyEdgeRepository topology, PayloadMasker masker, ObjectMapper mapper) {
        this.admin = admin;
        this.consumers = consumers;
        this.topology = topology;
        this.masker = masker;
        this.mapper = mapper;
    }

    private <X> X await(org.apache.kafka.common.KafkaFuture<X> f) {
        try { return f.get(T, TimeUnit.SECONDS); }
        catch (InterruptedException e) { Thread.currentThread().interrupt(); throw unavailable(e); }
        catch (Exception e) { throw unavailable(e); }
    }

    private BusinessException unavailable(Exception e) {
        log.warn("Kafka metadata call failed: {}", e.toString());
        return new BusinessException(HttpStatus.SERVICE_UNAVAILABLE, "KAFKA_UNAVAILABLE", "Kafka broker is not reachable right now");
    }

    // ---------------------------------------------------------------- cluster
    public Dtos.ClusterInfo cluster() {
        var c = admin.describeCluster();
        String id = await(c.clusterId());
        var nodes = await(c.nodes());
        var controller = await(c.controller());
        return new Dtos.ClusterInfo(id, nodes.size(), controller == null ? null : controller.host() + ":" + controller.port(),
                nodes.stream().map(n -> n.host() + ":" + n.port()).toList());
    }

    // ---------------------------------------------------------------- topics
    public List<Dtos.TopicSummary> topics() {
        Set<String> names = await(admin.listTopics().names()).stream().filter(n -> !n.startsWith("__")).collect(Collectors.toCollection(TreeSet::new));
        Map<String, TopicDescription> desc = await(admin.describeTopics(names).allTopicNames());
        Map<String, Map<String, String>> cfg = configs(names);
        Map<String, Long> counts = messageCounts(desc);
        Map<String, Set<String>> groupsByTopic = groupsByTopic();
        List<TopologyEdge> edges = topology.findAll();
        List<Dtos.TopicSummary> out = new ArrayList<>();
        for (String n : names) out.add(summary(n, desc.get(n), cfg.getOrDefault(n, Map.of()), counts.getOrDefault(n, 0L), groupsByTopic.getOrDefault(n, Set.of()), edges));
        return out;
    }

    public Dtos.TopicDetail topic(String name) {
        Map<String, TopicDescription> desc;
        try { desc = await(admin.describeTopics(List.of(name)).allTopicNames()); }
        catch (BusinessException e) { throw new NotFoundException("Topic", name); }
        TopicDescription d = desc.get(name);
        Map<TopicPartition, long[]> offs = offsets(d.partitions().stream().map(p -> new TopicPartition(name, p.partition())).toList());
        List<Dtos.PartitionInfo> parts = d.partitions().stream().map(p -> {
            long[] o = offs.getOrDefault(new TopicPartition(name, p.partition()), new long[]{0, 0});
            return new Dtos.PartitionInfo(p.partition(), p.leader() == null ? -1 : p.leader().id(), p.replicas().stream().map(r -> r.id()).toList(),
                    p.isr().stream().map(r -> r.id()).toList(), o[0], o[1]);
        }).toList();
        long total = parts.stream().mapToLong(p -> p.endOffset() - p.beginOffset()).sum();
        var s = summary(name, d, configs(Set.of(name)).getOrDefault(name, Map.of()), total, groupsByTopic().getOrDefault(name, Set.of()), topology.findAll());
        return new Dtos.TopicDetail(s, parts, topology.findByTopic(name).stream()
                .map(e -> new Dtos.TopologyDto(e.getService(), e.getRole(), e.getTopic(), e.getGroupId(), e.getClassName(), e.getMethod())).toList());
    }

    private Dtos.TopicSummary summary(String n, TopicDescription d, Map<String, String> cfg, long count, Set<String> groups, List<TopologyEdge> edges) {
        boolean dlt = n.endsWith(".DLT");
        String base = dlt ? n.substring(0, n.length() - 4) : n;
        List<String> producers = edges.stream().filter(e -> e.getTopic().equals(n) && "PRODUCER".equals(e.getRole())).map(e -> e.getService() + " / " + e.getClassName()).distinct().sorted().toList();
        List<String> cons = edges.stream().filter(e -> e.getTopic().equals(n) && "CONSUMER".equals(e.getRole())).map(e -> e.getService() + " / " + e.getClassName()).distinct().sorted().toList();
        String desc = Topics.BUSINESS.get(base);
        if (desc == null && n.equals(Topics.AUDIT_PROCESSING)) desc = "Technical: consumer processing results for the event audit";
        if (desc == null && n.equals(Topics.AUDIT_TOPOLOGY)) desc = "Technical: producer/consumer map announced by services";
        if (dlt && desc != null) desc = "Dead-letter topic: " + desc;
        int rf = d.partitions().isEmpty() ? 0 : d.partitions().get(0).replicas().size();
        String status = dlt ? (count > 0 ? "HAS_DEAD_LETTERS" : "EMPTY") : groups.isEmpty() ? "NO_ACTIVE_GROUP" : "ACTIVE";
        return new Dtos.TopicSummary(n, desc, d.partitions().size(), rf, cfg, count, producers, cons, groups.stream().sorted().toList(), status, dlt);
    }

    private Map<String, Map<String, String>> configs(Collection<String> topics) {
        List<ConfigResource> res = topics.stream().map(t -> new ConfigResource(ConfigResource.Type.TOPIC, t)).toList();
        Map<ConfigResource, Config> all = await(admin.describeConfigs(res).all());
        Map<String, Map<String, String>> out = new HashMap<>();
        all.forEach((r, c) -> {
            Map<String, String> m = new LinkedHashMap<>();
            for (String k : CONFIG_KEYS) { ConfigEntry e = c.get(k); if (e != null) m.put(k, e.value()); }
            out.put(r.name(), m);
        });
        return out;
    }

    private Map<String, Long> messageCounts(Map<String, TopicDescription> desc) {
        List<TopicPartition> tps = desc.values().stream().flatMap(d -> d.partitions().stream().map(p -> new TopicPartition(d.name(), p.partition()))).toList();
        Map<TopicPartition, long[]> o = offsets(tps);
        Map<String, Long> out = new HashMap<>();
        o.forEach((tp, v) -> out.merge(tp.topic(), v[1] - v[0], Long::sum));
        return out;
    }

    private Map<TopicPartition, long[]> offsets(Collection<TopicPartition> tps) {
        if (tps.isEmpty()) return Map.of();
        try (Consumer<String, String> c = consumers.createConsumer("event-audit-peek", "offsets")) {
            Map<TopicPartition, Long> begin = c.beginningOffsets(tps, Duration.ofSeconds(T));
            Map<TopicPartition, Long> end = c.endOffsets(tps, Duration.ofSeconds(T));
            Map<TopicPartition, long[]> out = new HashMap<>();
            for (TopicPartition tp : tps) out.put(tp, new long[]{begin.getOrDefault(tp, 0L), end.getOrDefault(tp, 0L)});
            return out;
        } catch (Exception e) { throw unavailable(e); }
    }

    // ---------------------------------------------------------------- consumer groups
    private Map<String, Set<String>> groupsByTopic() {
        Map<String, Set<String>> m = new HashMap<>();
        for (var g : await(admin.listConsumerGroups().all())) {
            var offs = await(admin.listConsumerGroupOffsets(g.groupId()).partitionsToOffsetAndMetadata());
            offs.keySet().forEach(tp -> m.computeIfAbsent(tp.topic(), k -> new TreeSet<>()).add(g.groupId()));
        }
        return m;
    }

    public List<Dtos.GroupInfo> groups() {
        var listed = await(admin.listConsumerGroups().all()).stream().map(ConsumerGroupListing::groupId).sorted().toList();
        if (listed.isEmpty()) return List.of();
        Map<String, ConsumerGroupDescription> desc = await(admin.describeConsumerGroups(listed).all());
        Map<String, Map<TopicPartition, OffsetAndMetadata>> offsets = new LinkedHashMap<>();
        for (String g : listed) offsets.put(g, await(admin.listConsumerGroupOffsets(g).partitionsToOffsetAndMetadata()));
        Set<TopicPartition> all = offsets.values().stream().flatMap(m -> m.keySet().stream()).collect(Collectors.toSet());
        Map<TopicPartition, long[]> ends = offsets(all);
        List<Dtos.GroupInfo> out = new ArrayList<>();
        for (String g : listed) {
            ConsumerGroupDescription d = desc.get(g);
            Map<TopicPartition, String> owner = new HashMap<>();
            List<Dtos.GroupMember> members = new ArrayList<>();
            for (MemberDescription m : d.members()) {
                members.add(new Dtos.GroupMember(m.clientId(), m.host(), m.assignment().topicPartitions().stream().map(tp -> tp.topic() + "-" + tp.partition()).sorted().toList()));
                m.assignment().topicPartitions().forEach(tp -> owner.put(tp, m.clientId()));
            }
            List<Dtos.GroupTopicLag> lags = new ArrayList<>();
            long total = 0;
            TreeMap<TopicPartition, OffsetAndMetadata> sorted = new TreeMap<>(Comparator.<TopicPartition, String>comparing(TopicPartition::topic).thenComparingInt(TopicPartition::partition));
            sorted.putAll(offsets.get(g));
            for (var e : sorted.entrySet()) {
                long end = ends.getOrDefault(e.getKey(), new long[]{0, 0})[1];
                long cur = e.getValue().offset();
                long lag = Math.max(0, end - cur);
                total += lag;
                lags.add(new Dtos.GroupTopicLag(e.getKey().topic(), e.getKey().partition(), cur, end, lag, owner.get(e.getKey())));
            }
            out.add(new Dtos.GroupInfo(g, d.state() == null ? ConsumerGroupState.UNKNOWN.name() : d.state().name(), d.coordinator() == null ? null : d.coordinator().host() + ":" + d.coordinator().port(),
                    d.partitionAssignor(), lags.stream().map(Dtos.GroupTopicLag::topic).distinct().toList(), members, lags, total));
        }
        return out;
    }

    // ---------------------------------------------------------------- producer -> topic -> consumer graph
    public Dtos.Flow flow() {
        Map<String, Dtos.FlowNode> nodes = new LinkedHashMap<>();
        List<Dtos.FlowEdge> edges = new ArrayList<>();
        for (TopologyEdge e : topology.findAll()) {
            if (e.getTopic().startsWith("audit.")) continue;
            String svc = "svc:" + e.getService(), top = "topic:" + e.getTopic();
            nodes.putIfAbsent(svc, new Dtos.FlowNode(svc, "service", e.getService()));
            nodes.putIfAbsent(top, new Dtos.FlowNode(top, "topic", e.getTopic()));
            if ("PRODUCER".equals(e.getRole())) edges.add(new Dtos.FlowEdge(svc, top, "produces", e.getClassName()));
            else edges.add(new Dtos.FlowEdge(top, svc, "consumes", e.getClassName() + (e.getGroupId() == null ? "" : " [" + e.getGroupId() + "]")));
        }
        return new Dtos.Flow(new ArrayList<>(nodes.values()), edges);
    }

    // ---------------------------------------------------------------- messages straight from the broker
    public List<Dtos.KafkaMessage> messages(String topic, Integer partition, Long fromOffset, int limit) {
        int max = Math.min(Math.max(limit, 1), 200);
        TopicDescription d;
        try { d = await(admin.describeTopics(List.of(topic)).allTopicNames()).get(topic); }
        catch (BusinessException e) { throw new NotFoundException("Topic", topic); }
        List<TopicPartition> tps = d.partitions().stream().filter(p -> partition == null || p.partition() == partition).map(p -> new TopicPartition(topic, p.partition())).toList();
        if (tps.isEmpty()) throw new NotFoundException("Partition", partition);
        List<ConsumerRecord<String, String>> records = new ArrayList<>();
        try (Consumer<String, String> c = consumers.createConsumer("event-audit-peek", "messages")) {
            c.assign(tps);
            Map<TopicPartition, Long> begin = c.beginningOffsets(tps, Duration.ofSeconds(T)), end = c.endOffsets(tps, Duration.ofSeconds(T));
            for (TopicPartition tp : tps) {
                long start = fromOffset != null ? Math.max(begin.get(tp), fromOffset) : Math.max(begin.get(tp), end.get(tp) - max);
                c.seek(tp, start);
            }
            long deadline = System.currentTimeMillis() + 4000;
            while (System.currentTimeMillis() < deadline && !reached(c, tps, end)) {
                ConsumerRecords<String, String> polled = c.poll(Duration.ofMillis(300));
                polled.forEach(records::add);
                if (fromOffset != null && records.size() >= max) break;
            }
        } catch (BusinessException e) { throw e; }
        catch (Exception e) { throw unavailable(e); }
        records.sort(Comparator.comparingLong((ConsumerRecord<String, String> r) -> r.timestamp()).thenComparingLong(ConsumerRecord::offset).reversed());
        if (fromOffset != null) records.sort(Comparator.comparingInt((ConsumerRecord<String, String> r) -> r.partition()).thenComparingLong(ConsumerRecord::offset));
        return records.stream().limit(max).map(r -> toMessage(r)).toList();
    }

    private boolean reached(Consumer<String, String> c, List<TopicPartition> tps, Map<TopicPartition, Long> end) {
        for (TopicPartition tp : tps) if (c.position(tp, Duration.ofSeconds(T)) < end.get(tp)) return false;
        return true;
    }

    /** Raw record at one exact position (used by replay): returns the unmodified key/value/headers. */
    public ConsumerRecord<String, String> readExact(String topic, int partition, long offset) {
        TopicPartition tp = new TopicPartition(topic, partition);
        try (Consumer<String, String> c = consumers.createConsumer("event-audit-peek", "exact")) {
            c.assign(List.of(tp));
            long begin = c.beginningOffsets(List.of(tp), Duration.ofSeconds(T)).get(tp), end = c.endOffsets(List.of(tp), Duration.ofSeconds(T)).get(tp);
            if (offset < begin || offset >= end) return null;      // already expired by retention
            c.seek(tp, offset);
            long deadline = System.currentTimeMillis() + 4000;
            while (System.currentTimeMillis() < deadline) {
                for (ConsumerRecord<String, String> r : c.poll(Duration.ofMillis(300))) if (r.offset() == offset) return r;
            }
            return null;
        } catch (Exception e) { throw unavailable(e); }
    }

    private Dtos.KafkaMessage toMessage(ConsumerRecord<String, String> r) {
        Map<String, String> headers = new LinkedHashMap<>();
        for (Header h : r.headers()) {
            if (h.key().toLowerCase().contains("authorization")) continue;
            String v = h.value() == null ? null : new String(h.value(), StandardCharsets.UTF_8);
            headers.put(h.key(), v == null ? null : (v.length() > 300 ? v.substring(0, 300) + "..." : v));
        }
        String eventId = null, type = null, producer = null, cid = null, value = r.value();
        boolean masked = false;
        try {
            JsonNode n = mapper.readTree(r.value());
            if (n.has("eventId")) {
                eventId = n.path("eventId").asText(null);
                type = n.path("eventType").asText(null);
                producer = n.path("producerService").asText(null);
                cid = n.path("correlationId").asText(null);
                if (n instanceof ObjectNode o && n.has("payload")) {
                    o.set("payload", mapper.readTree(masker.mask(n.get("payload"), type)));
                    value = mapper.writerWithDefaultPrettyPrinter().writeValueAsString(o);
                    masked = true;
                }
            }
        } catch (Exception ignored) { /* non-JSON value: shown as is */ }
        return new Dtos.KafkaMessage(r.topic(), r.partition(), r.offset(), r.key(), Instant.ofEpochMilli(r.timestamp()), headers, eventId, type, producer, cid, value, masked);
    }
}
