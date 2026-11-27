package com.fooddelivery.eventaudit.monitor;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.fooddelivery.common.exception.BusinessException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Controlled, read-only gateway to Elasticsearch for the Angular logging screens (Angular never talks to Elasticsearch).
 * Only the whitelisted filters below can reach the query: no raw DSL from the client, so a caller cannot read other indices or write.
 */
@Service
public class LogSearchService {
    private static final Logger log = LoggerFactory.getLogger(LogSearchService.class);
    private final RestClient es;
    private final ObjectMapper mapper;
    private final String index;
    private final String kibanaUrl;

    public LogSearchService(ObjectMapper mapper, @Value("${food.logging.elasticsearch-url}") String url, @Value("${food.logging.index-pattern}") String index,
                            @Value("${food.logging.kibana-url}") String kibanaUrl) {
        this.mapper = mapper;
        this.es = RestClient.builder().baseUrl(url).defaultHeader("Content-Type", MediaType.APPLICATION_JSON_VALUE).build();
        this.index = index;
        this.kibanaUrl = kibanaUrl;
    }

    public record Filters(String q, String service, String level, String correlationId, String traceId, String category, Instant from, Instant to) {}

    public Map<String, Object> config() { return Map.of("kibanaUrl", kibanaUrl, "indexPattern", index); }

    private ObjectNode boolQuery(Filters f) {
        ObjectNode bool = mapper.createObjectNode();
        ArrayNode must = bool.putArray("must"), filter = bool.putArray("filter");
        if (f.q() != null && !f.q().isBlank()) {
            ObjectNode sq = must.addObject().putObject("simple_query_string");
            sq.put("query", f.q().trim());
            sq.putArray("fields").add("message").add("error.message").add("logger").add("error.class");
            sq.put("default_operator", "and");
        }
        term(filter, "service", f.service());
        term(filter, "level", f.level() == null ? null : f.level().toUpperCase());
        term(filter, "correlationId", f.correlationId());
        term(filter, "traceId", f.traceId());
        term(filter, "category", f.category());
        if (f.from() != null || f.to() != null) {
            ObjectNode range = filter.addObject().putObject("range").putObject("@timestamp");
            if (f.from() != null) range.put("gte", f.from().toString());
            if (f.to() != null) range.put("lt", f.to().toString());
        }
        return bool;
    }

    private void term(ArrayNode filter, String field, String value) {
        if (value != null && !value.isBlank()) filter.addObject().putObject("term").put(field, value.trim());
    }

    private JsonNode search(ObjectNode body) {
        try {
            return es.post().uri("/{index}/_search?ignore_unavailable=true&allow_no_indices=true", index).body(body.toString()).retrieve().body(JsonNode.class);
        } catch (Exception e) {
            log.warn("Elasticsearch query failed: {}", e.toString());
            throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE, "LOGS_UNAVAILABLE", "The log store (Elasticsearch) is not reachable right now");
        }
    }

    public Map<String, Object> searchLogs(Filters f, int page, int size, boolean ascending) {
        int sz = Math.min(Math.max(size, 1), 100);
        ObjectNode body = mapper.createObjectNode();
        body.putObject("query").set("bool", boolQuery(f));
        body.put("from", Math.max(page, 0) * sz).put("size", sz).put("track_total_hits", true);
        body.putArray("sort").addObject().putObject("@timestamp").put("order", ascending ? "asc" : "desc").put("unmapped_type", "date");
        JsonNode r = search(body);
        Map<String, Object> out = new LinkedHashMap<>();
        var hits = mapper.createArrayNode();
        for (JsonNode h : r.path("hits").path("hits")) hits.add(toHit(h, false));
        out.put("total", r.path("hits").path("total").path("value").asLong());
        out.put("page", page);
        out.put("size", sz);
        out.put("hits", hits);
        return out;
    }

    public JsonNode detail(String indexName, String id) {
        if (!indexName.startsWith("food-logs-")) throw new BusinessException(HttpStatus.BAD_REQUEST, "BAD_INDEX", "Unknown index");
        try {
            JsonNode r = es.get().uri("/{i}/_doc/{id}", indexName, id).retrieve().body(JsonNode.class);
            return toHit(r, true);
        } catch (BusinessException e) { throw e; }
        catch (Exception e) { throw new BusinessException(HttpStatus.NOT_FOUND, "NOT_FOUND", "Log entry not found"); }
    }

    private JsonNode toHit(JsonNode h, boolean full) {
        JsonNode s = h.path("_source");
        ObjectNode o = mapper.createObjectNode();
        o.put("id", h.path("_id").asText()).put("index", h.path("_index").asText());
        for (String k : new String[]{"@timestamp", "level", "service", "logger", "message", "correlationId", "traceId", "spanId", "category", "httpMethod", "httpPath", "httpStatus", "durationMs", "userId", "eventId", "thread"}) {
            if (s.has(k)) o.set(k, s.get(k));
        }
        JsonNode err = s.path("error");
        if (!err.isMissingNode()) {
            ObjectNode e = o.putObject("error");
            e.put("class", err.path("class").asText(null)).put("message", err.path("message").asText(null));
            if (full) e.put("stack", err.path("stack").asText(err.path("stack_trace").asText(null)));
        }
        return o;
    }

    /** Dashboard numbers for a time window: totals by service/level/category and the latest errors. */
    public Map<String, Object> overview(Instant from) {
        Filters f = new Filters(null, null, null, null, null, null, from, null);
        ObjectNode body = mapper.createObjectNode();
        body.putObject("query").set("bool", boolQuery(f));
        body.put("size", 0).put("track_total_hits", true);
        ObjectNode aggs = body.putObject("aggs");
        aggs.putObject("by_service").putObject("terms").put("field", "service").put("size", 30);
        aggs.putObject("by_level").putObject("terms").put("field", "level").put("size", 10);
        aggs.putObject("by_category").putObject("terms").put("field", "category").put("size", 12);
        JsonNode r = search(body);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("total", r.path("hits").path("total").path("value").asLong());
        out.put("byService", buckets(r.path("aggregations").path("by_service")));
        out.put("byLevel", buckets(r.path("aggregations").path("by_level")));
        out.put("byCategory", buckets(r.path("aggregations").path("by_category")));
        out.put("recentErrors", searchLogs(new Filters(null, null, "ERROR", null, null, null, from, null), 0, 10, false).get("hits"));
        return out;
    }

    private Map<String, Long> buckets(JsonNode agg) {
        Map<String, Long> m = new LinkedHashMap<>();
        for (JsonNode b : agg.path("buckets")) m.put(b.path("key").asText(), b.path("doc_count").asLong());
        return m;
    }
}
