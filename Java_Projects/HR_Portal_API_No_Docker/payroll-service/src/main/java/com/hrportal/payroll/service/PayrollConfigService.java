package com.hrportal.payroll.service;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hrportal.common.audit.AuditService;
import com.hrportal.common.cache.CacheEvictor;
import com.hrportal.common.exception.BadRequestException;
import com.hrportal.common.exception.ResourceNotFoundException;
import com.hrportal.payroll.dto.PayrollDtos.ConfigResponse;
import com.hrportal.payroll.dto.PayrollDtos.ConfigUpdate;
import com.hrportal.payroll.engine.PayrollSettings;
import com.hrportal.payroll.entity.PayrollConfig;
import com.hrportal.payroll.repository.PayrollRepositories.ConfigRepository;

/** Payroll / statutory configuration (database driven, Redis cached, every change audited). */
@Service
public class PayrollConfigService {
    private final ConfigRepository repository;
    private final AuditService audit;
    private final CacheEvictor cache;
    private final ObjectMapper mapper;

    public PayrollConfigService(ConfigRepository repository, AuditService audit, CacheEvictor cache, ObjectMapper mapper) {
        this.repository = repository;
        this.audit = audit;
        this.cache = cache;
        this.mapper = mapper;
    }

    @Transactional(readOnly = true)
    public List<ConfigResponse> all() {
        return repository.findAll().stream().sorted(java.util.Comparator.comparing(PayrollConfig::getConfigKey))
                .map(c -> new ConfigResponse(c.getConfigKey(), c.getConfigValue(), c.getDescription(), c.getEffectiveFrom())).toList();
    }

    @Transactional(readOnly = true)
    @Cacheable(cacheNames = "payrollConfig", key = "'map'")
    public Map<String, String> asMap() {
        Map<String, String> m = new LinkedHashMap<>();
        repository.findAll().forEach(c -> m.put(c.getConfigKey(), c.getConfigValue()));
        return m;
    }

    public PayrollSettings settings() {
        return PayrollSettings.from(asMap(), mapper);
    }

    @Transactional
    public ConfigResponse update(String key, ConfigUpdate req) {
        PayrollConfig c = repository.findByConfigKey(key).orElseThrow(() -> ResourceNotFoundException.of("Configuration key", key));
        String before = c.getConfigValue();
        c.setConfigValue(req.value());
        if (req.description() != null) c.setDescription(req.description());
        c.setEffectiveFrom(java.time.Instant.now());
        repository.save(c);
        try {
            PayrollSettings.from(asMap2(key, req.value()), mapper);          // refuse values the engine cannot parse
        } catch (IllegalStateException e) {
            throw new BadRequestException("Value rejected: " + e.getMessage());
        }
        cache.clear("payrollConfig");
        audit.record("PayrollConfig", key, "UPDATED", before, req.value());
        return new ConfigResponse(c.getConfigKey(), c.getConfigValue(), c.getDescription(), c.getEffectiveFrom());
    }

    private Map<String, String> asMap2(String key, String value) {
        Map<String, String> m = new LinkedHashMap<>();
        repository.findAll().forEach(c -> m.put(c.getConfigKey(), c.getConfigKey().equals(key) ? value : c.getConfigValue()));
        return m;
    }
}
