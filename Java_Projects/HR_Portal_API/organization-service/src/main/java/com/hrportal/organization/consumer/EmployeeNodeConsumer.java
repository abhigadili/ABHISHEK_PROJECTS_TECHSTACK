package com.hrportal.organization.consumer;

import java.time.Instant;
import java.util.Objects;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import com.hrportal.common.cache.CacheEvictor;
import com.hrportal.common.events.HrEvents.EmployeeCreated;
import com.hrportal.common.events.HrEvents.EmployeeExited;
import com.hrportal.common.events.HrEvents.EmployeeTerminated;
import com.hrportal.common.events.HrEvents.EmployeeUpdated;
import com.hrportal.common.events.Topics;
import com.hrportal.common.kafka.IdempotentEventProcessor;
import com.hrportal.organization.entity.OrgEmployeeNode;
import com.hrportal.organization.entity.ReportingLine;
import com.hrportal.organization.repository.OrgEmployeeNodeRepository;
import com.hrportal.organization.repository.ReportingLineRepository;

/** Keeps the org read model (nodes + reporting-line history) in step with the Employee service through Kafka events. */
@Component
public class EmployeeNodeConsumer {
    private static final Logger log = LoggerFactory.getLogger(EmployeeNodeConsumer.class);
    private final IdempotentEventProcessor processor;
    private final OrgEmployeeNodeRepository nodes;
    private final ReportingLineRepository lines;
    private final CacheEvictor cache;

    public EmployeeNodeConsumer(IdempotentEventProcessor processor, OrgEmployeeNodeRepository nodes, ReportingLineRepository lines, CacheEvictor cache) {
        this.processor = processor;
        this.nodes = nodes;
        this.lines = lines;
        this.cache = cache;
    }

    @KafkaListener(topics = Topics.EMPLOYEE_CREATED, groupId = "hr-organization-service")
    public void onCreated(String payload) {
        processor.handle(payload, EmployeeCreated.class, "org.employee-created", e -> {
            OrgEmployeeNode n = nodes.findById(e.employeeId()).orElseGet(OrgEmployeeNode::new);
            n.setEmployeeId(e.employeeId());
            n.setEmployeeCode(e.employeeCode());
            n.setFullName((e.firstName() + " " + e.lastName()).trim());
            n.setEmail(e.workEmail());
            n.setDepartmentId(e.departmentId());
            n.setDesignationId(e.designationId());
            n.setLocationId(e.locationId());
            n.setManagerId(e.managerId());
            n.setStatus(e.status() == null ? "ACTIVE" : e.status());
            n.setJoiningDate(e.joiningDate());
            n.setUpdatedAt(Instant.now());
            nodes.save(n);
            changeManager(e.employeeId(), e.managerId());
            evict();
        });
    }

    @KafkaListener(topics = Topics.EMPLOYEE_UPDATED, groupId = "hr-organization-service")
    @Transactional
    public void onUpdated(String payload) {
        processor.handle(payload, EmployeeUpdated.class, "org.employee-updated", e -> {
            OrgEmployeeNode n = nodes.findById(e.employeeId()).orElseGet(OrgEmployeeNode::new);
            boolean isNew = n.getEmployeeId() == null;
            n.setEmployeeId(e.employeeId());
            n.setEmployeeCode(e.employeeCode());
            if (e.fullName() != null) n.setFullName(e.fullName());
            else if (isNew) n.setFullName(e.employeeId());
            n.setEmail(e.workEmail());
            n.setDepartmentId(e.departmentId());
            n.setDesignationId(e.designationId());
            n.setLocationId(e.locationId());
            boolean managerChanged = isNew || !Objects.equals(n.getManagerId(), e.managerId());
            n.setManagerId(e.managerId());
            if (e.status() != null) n.setStatus(e.status());
            n.setUpdatedAt(Instant.now());
            nodes.save(n);
            if (managerChanged) changeManager(e.employeeId(), e.managerId());
            evict();
        });
    }

    @KafkaListener(topics = Topics.EMPLOYEE_TERMINATED, groupId = "hr-organization-service")
    public void onTerminated(String payload) {
        processor.handle(payload, EmployeeTerminated.class, "org.employee-terminated", e -> markGone(e.employeeId(), "TERMINATED"));
    }

    @KafkaListener(topics = Topics.EMPLOYEE_EXITED, groupId = "hr-organization-service")
    public void onExited(String payload) {
        processor.handle(payload, EmployeeExited.class, "org.employee-exited", e -> markGone(e.employeeId(), "RESIGNED".equals(e.exitType()) ? "RESIGNED" : "TERMINATED"));
    }

    private void markGone(String employeeId, String status) {
        nodes.findById(employeeId).ifPresent(n -> {
            n.setStatus(status);
            n.setUpdatedAt(Instant.now());
            nodes.save(n);
            log.info("Org node {} marked {}", employeeId, status);
        });
        evict();
    }

    private void changeManager(String employeeId, String managerId) {
        lines.findFirstByEmployeeIdAndEffectiveToIsNull(employeeId).ifPresent(open -> {
            if (Objects.equals(open.getManagerId(), managerId)) return;
            open.setEffectiveTo(Instant.now());
            lines.save(open);
        });
        if (lines.findFirstByEmployeeIdAndEffectiveToIsNull(employeeId).isEmpty()) {
            ReportingLine l = new ReportingLine();
            l.setEmployeeId(employeeId);
            l.setManagerId(managerId);
            lines.save(l);
        }
    }

    private void evict() {
        cache.clear("orgChart", "departmentTree");
    }
}
