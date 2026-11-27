package com.fooddelivery.eventaudit.monitor;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fooddelivery.common.security.ServiceTokenProvider;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.cloud.client.ServiceInstance;
import org.springframework.cloud.client.discovery.DiscoveryClient;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.net.http.HttpClient;
import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;

/**
 * Application-level health overview: asks the Eureka registry which services/instances exist, then calls each instance's
 * /actuator/health with a service token (role SERVICE may see component details: db, redis, kafka). Results are cached for 5 s.
 */
@Service
public class HealthMonitorService {
    private static final Logger log = LoggerFactory.getLogger(HealthMonitorService.class);
    private static final List<String> EXPECTED = List.of("user-service", "customer-service", "restaurant-service", "menu-service", "cart-service", "order-service",
            "payment-service", "delivery-service", "notification-service", "review-service", "coupon-service", "inventory-service", "search-service", "admin-service",
            "event-audit-service", "api-gateway");
    private final DiscoveryClient discovery;
    private final ServiceTokenProvider tokens;
    private final ObjectMapper mapper;
    private final RestClient http;
    private final ExecutorService pool = Executors.newFixedThreadPool(8);
    private volatile Instant cachedAt = Instant.EPOCH;
    private volatile List<Map<String, Object>> cache = List.of();

    public HealthMonitorService(DiscoveryClient discovery, ServiceTokenProvider tokens, ObjectMapper mapper) {
        this.discovery = discovery;
        this.tokens = tokens;
        this.mapper = mapper;
        HttpClient client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(2)).build();
        JdkClientHttpRequestFactory f = new JdkClientHttpRequestFactory(client);
        f.setReadTimeout(Duration.ofSeconds(3));
        this.http = RestClient.builder().requestFactory(f).build();
    }

    public synchronized List<Map<String, Object>> overview() {
        if (cachedAt.isAfter(Instant.now().minusSeconds(5))) return cache;
        Set<String> registered = new TreeSet<>(discovery.getServices().stream().map(String::toLowerCase).toList());
        List<Future<Map<String, Object>>> futures = new ArrayList<>();
        List<String> names = new ArrayList<>(EXPECTED);
        registered.stream().filter(s -> !names.contains(s)).forEach(names::add);
        for (String name : names) {
            List<ServiceInstance> instances = discovery.getInstances(name);
            if (instances.isEmpty()) futures.add(CompletableFuture.completedFuture(down(name, "NOT_REGISTERED")));
            else for (ServiceInstance si : instances) futures.add(pool.submit(() -> probe(name, si)));
        }
        List<Map<String, Object>> out = new ArrayList<>();
        for (Future<Map<String, Object>> f : futures) {
            try { out.add(f.get(5, TimeUnit.SECONDS)); } catch (Exception e) { log.debug("health probe timed out"); }
        }
        cache = out;
        cachedAt = Instant.now();
        return out;
    }

    private Map<String, Object> down(String name, String reason) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("service", name);
        m.put("status", "DOWN");
        m.put("reason", reason);
        m.put("checkedAt", Instant.now().toString());
        return m;
    }

    private Map<String, Object> probe(String name, ServiceInstance si) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("service", name);
        m.put("url", si.getUri().toString());
        m.put("port", si.getPort());
        m.put("instanceId", si.getInstanceId());
        m.put("checkedAt", Instant.now().toString());
        try {
            String body = http.get().uri(si.getUri() + "/actuator/health").header("Authorization", "Bearer " + tokens.token())
                    .exchange((req, res) -> new String(res.getBody().readAllBytes()));
            JsonNode n = mapper.readTree(body);
            m.put("status", n.path("status").asText("UNKNOWN"));
            JsonNode c = n.path("components");
            m.put("database", c.path("db").path("status").asText(null));
            m.put("redis", c.path("redis").path("status").asText(null));
            m.put("kafka", c.path("kafka").path("status").asText(null));
            m.put("discovery", c.path("discoveryComposite").path("status").asText(null));
        } catch (Exception e) {
            m.put("status", "DOWN");
            m.put("reason", e.getClass().getSimpleName());
        }
        return m;
    }
}
