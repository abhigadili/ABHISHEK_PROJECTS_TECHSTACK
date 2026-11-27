package com.hrportal.tax.consumer;

import java.time.Instant;

import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

import com.hrportal.common.events.HrEvents.EmployeeCreated;
import com.hrportal.common.events.HrEvents.EmployeeExited;
import com.hrportal.common.events.HrEvents.EmployeeTerminated;
import com.hrportal.common.events.HrEvents.EmployeeUpdated;
import com.hrportal.common.events.Topics;
import com.hrportal.common.kafka.IdempotentEventProcessor;
import com.hrportal.tax.entity.TaxEmployee;
import com.hrportal.tax.repository.TaxRepositories.TaxEmployeeRepository;

@Component
public class EmployeeEventsConsumer {
    private final IdempotentEventProcessor processor;
    private final TaxEmployeeRepository employees;

    public EmployeeEventsConsumer(IdempotentEventProcessor processor, TaxEmployeeRepository employees) {
        this.processor = processor;
        this.employees = employees;
    }

    @KafkaListener(topics = Topics.EMPLOYEE_CREATED, groupId = "hr-tax-service")
    public void onCreated(String payload) {
        processor.handle(payload, EmployeeCreated.class, "tax.employee-created", e -> {
            TaxEmployee t = employees.findById(e.employeeId()).orElseGet(TaxEmployee::new);
            t.setEmployeeId(e.employeeId());
            t.setFullName((e.firstName() + " " + e.lastName()).trim());
            t.setStatus(e.status() == null ? "ACTIVE" : e.status());
            t.setUpdatedAt(Instant.now());
            employees.save(t);
        });
    }

    @KafkaListener(topics = Topics.EMPLOYEE_UPDATED, groupId = "hr-tax-service")
    public void onUpdated(String payload) {
        processor.handle(payload, EmployeeUpdated.class, "tax.employee-updated", e -> employees.findById(e.employeeId()).ifPresent(t -> {
            if (e.fullName() != null) t.setFullName(e.fullName());
            if (e.status() != null) t.setStatus(e.status());
            t.setUpdatedAt(Instant.now());
            employees.save(t);
        }));
    }

    @KafkaListener(topics = Topics.EMPLOYEE_TERMINATED, groupId = "hr-tax-service")
    public void onTerminated(String payload) {
        processor.handle(payload, EmployeeTerminated.class, "tax.employee-terminated", e -> mark(e.employeeId(), "TERMINATED"));
    }

    @KafkaListener(topics = Topics.EMPLOYEE_EXITED, groupId = "hr-tax-service")
    public void onExited(String payload) {
        processor.handle(payload, EmployeeExited.class, "tax.employee-exited", e -> mark(e.employeeId(), "TERMINATED".equals(e.exitType()) ? "TERMINATED" : "RESIGNED"));
    }

    private void mark(String id, String status) {
        employees.findById(id).ifPresent(t -> {
            t.setStatus(status);
            employees.save(t);
        });
    }
}
