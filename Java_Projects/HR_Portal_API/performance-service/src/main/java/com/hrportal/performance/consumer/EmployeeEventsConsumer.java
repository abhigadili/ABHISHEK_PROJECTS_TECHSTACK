package com.hrportal.performance.consumer;

import java.time.Instant;

import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

import com.hrportal.common.events.HrEvents.EmployeeCreated;
import com.hrportal.common.events.HrEvents.EmployeeExited;
import com.hrportal.common.events.HrEvents.EmployeeTerminated;
import com.hrportal.common.events.HrEvents.EmployeeUpdated;
import com.hrportal.common.events.Topics;
import com.hrportal.common.kafka.IdempotentEventProcessor;
import com.hrportal.performance.entity.PerfEmployee;
import com.hrportal.performance.repository.PerformanceRepositories.PerfEmployeeRepository;

@Component
public class EmployeeEventsConsumer {
    private final IdempotentEventProcessor processor;
    private final PerfEmployeeRepository employees;

    public EmployeeEventsConsumer(IdempotentEventProcessor processor, PerfEmployeeRepository employees) {
        this.processor = processor;
        this.employees = employees;
    }

    @KafkaListener(topics = Topics.EMPLOYEE_CREATED, groupId = "hr-performance-service")
    public void onCreated(String payload) {
        processor.handle(payload, EmployeeCreated.class, "performance.employee-created", e -> {
            PerfEmployee p = employees.findById(e.employeeId()).orElseGet(PerfEmployee::new);
            p.setEmployeeId(e.employeeId());
            p.setFullName((e.firstName() + " " + e.lastName()).trim());
            p.setManagerId(e.managerId());
            p.setDepartmentId(e.departmentId());
            p.setStatus(e.status() == null ? "ACTIVE" : e.status());
            p.setUpdatedAt(Instant.now());
            employees.save(p);
        });
    }

    @KafkaListener(topics = Topics.EMPLOYEE_UPDATED, groupId = "hr-performance-service")
    public void onUpdated(String payload) {
        processor.handle(payload, EmployeeUpdated.class, "performance.employee-updated", e -> employees.findById(e.employeeId()).ifPresent(p -> {
            if (e.fullName() != null) p.setFullName(e.fullName());
            p.setManagerId(e.managerId());
            p.setDepartmentId(e.departmentId());
            if (e.status() != null) p.setStatus(e.status());
            p.setUpdatedAt(Instant.now());
            employees.save(p);
        }));
    }

    @KafkaListener(topics = Topics.EMPLOYEE_TERMINATED, groupId = "hr-performance-service")
    public void onTerminated(String payload) {
        processor.handle(payload, EmployeeTerminated.class, "performance.employee-terminated", e -> mark(e.employeeId(), "TERMINATED"));
    }

    @KafkaListener(topics = Topics.EMPLOYEE_EXITED, groupId = "hr-performance-service")
    public void onExited(String payload) {
        processor.handle(payload, EmployeeExited.class, "performance.employee-exited", e -> mark(e.employeeId(), "TERMINATED".equals(e.exitType()) ? "TERMINATED" : "RESIGNED"));
    }

    private void mark(String id, String status) {
        employees.findById(id).ifPresent(p -> {
            p.setStatus(status);
            employees.save(p);
        });
    }
}
