package com.hrportal.reporting.client;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Component;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.hrportal.common.client.HrWebClient;
import com.hrportal.common.client.WebClientFactory;

/** Resolves department ids to names through the Organization service (WebClient, cached in Redis for 30 minutes); on failure the id is shown. */
@Component
public class DepartmentNames {
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Dept(String id, String name) { }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record DeptPage(List<Dept> content) { }

    private final HrWebClient org;

    public DepartmentNames(WebClientFactory factory, @Value("${hr.services.organization.url}") String url) {
        this.org = factory.create(url);
    }

    @Cacheable(cacheNames = "departmentNames", key = "'all'", unless = "#result.isEmpty()")
    public Map<String, String> all() {
        Map<String, String> out = new HashMap<>();
        try {
            DeptPage page = org.get("/api/v1/organization/departments?size=200", DeptPage.class).block();
            if (page != null) page.content().forEach(d -> out.put(d.id(), d.name()));
        } catch (RuntimeException e) {
            // names are decoration only: reports still work with ids
        }
        return out;
    }

    public String name(String id) {
        return id == null ? "(none)" : all().getOrDefault(id, id);
    }
}
