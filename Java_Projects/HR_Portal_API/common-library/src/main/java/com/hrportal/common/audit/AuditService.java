package com.hrportal.common.audit;

import java.time.Instant;

import org.slf4j.MDC;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hrportal.common.security.CurrentUser;

/** Writes business audit rows inside the caller's transaction (state change and audit record commit together). */
@Service
public class AuditService {
    private final AuditHistoryRepository repository;
    private final ObjectMapper mapper;

    public AuditService(AuditHistoryRepository repository, ObjectMapper mapper) {
        this.repository = repository;
        this.mapper = mapper;
    }

    @Transactional(propagation = Propagation.REQUIRED)
    public void record(String entityType, String entityId, String action, Object previous, Object current) {
        AuditHistory h = new AuditHistory();
        h.setEntityType(entityType);
        h.setEntityId(String.valueOf(entityId));
        h.setAction(action);
        h.setPreviousValue(json(previous));
        h.setNewValue(json(current));
        h.setUserId(CurrentUser.auditName());
        h.setCorrelationId(MDC.get("correlationId"));
        h.setCreatedAt(Instant.now());
        repository.save(h);
    }

    public void record(String entityType, String entityId, String action, Object current) {
        record(entityType, entityId, action, null, current);
    }

    private String json(Object o) {
        if (o == null) return null;
        if (o instanceof String s) return s;
        try {
            return mapper.writeValueAsString(o);
        } catch (JsonProcessingException e) {
            return String.valueOf(o);
        }
    }
}
