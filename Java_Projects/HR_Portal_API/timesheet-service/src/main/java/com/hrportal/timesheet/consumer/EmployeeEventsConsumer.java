package com.hrportal.timesheet.consumer;

import java.time.Instant;

import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

import com.hrportal.common.events.HrEvents.EmployeeCreated;
import com.hrportal.common.events.HrEvents.EmployeeExited;
import com.hrportal.common.events.HrEvents.EmployeeTerminated;
import com.hrportal.common.events.HrEvents.EmployeeUpdated;
import com.hrportal.common.events.Topics;
import com.hrportal.common.kafka.IdempotentEventProcessor;
import com.hrportal.timesheet.entity.TimesheetEmployee;
import com.hrportal.timesheet.repository.TimesheetRepositories.TimesheetEmployeeRepository;

@Component
public class EmployeeEventsConsumer {
    private final IdempotentEventProcessor processor;
    private final TimesheetEmployeeRepository employees;

    public EmployeeEventsConsumer(IdempotentEventProcessor processor, TimesheetEmployeeRepository employees) {
        this.processor = processor;
        this.employees = employees;
    }

    @KafkaListener(topics = Topics.EMPLOYEE_CREATED, groupId = "hr-timesheet-service")
    public void onCreated(String payload) {
        processor.handle(payload, EmployeeCreated.class, "timesheet.employee-created", e -> {
            TimesheetEmployee t = employees.findById(e.employeeId()).orElseGet(TimesheetEmployee::new);
            t.setEmployeeId(e.employeeId());
            t.setFullName((e.firstName() + " " + e.lastName()).trim());
            t.setManagerId(e.managerId());
            t.setStatus(e.status() == null ? "ACTIVE" : e.status());
            t.setUpdatedAt(Instant.now());
            employees.save(t);
        });
    }

    @KafkaListener(topics = Topics.EMPLOYEE_UPDATED, groupId = "hr-timesheet-service")
    public void onUpdated(String payload) {
        processor.handle(payload, EmployeeUpdated.class, "timesheet.employee-updated", e -> employees.findById(e.employeeId()).ifPresent(t -> {
            if (e.fullName() != null) t.setFullName(e.fullName());
            t.setManagerId(e.managerId());
            if (e.status() != null) t.setStatus(e.status());
            t.setUpdatedAt(Instant.now());
            employees.save(t);
        }));
    }

    @KafkaListener(topics = Topics.EMPLOYEE_TERMINATED, groupId = "hr-timesheet-service")
    public void onTerminated(String payload) {
        processor.handle(payload, EmployeeTerminated.class, "timesheet.employee-terminated", e -> mark(e.employeeId(), "TERMINATED"));
    }

    @KafkaListener(topics = Topics.EMPLOYEE_EXITED, groupId = "hr-timesheet-service")
    public void onExited(String payload) {
        processor.handle(payload, EmployeeExited.class, "timesheet.employee-exited", e -> mark(e.employeeId(), "TERMINATED".equals(e.exitType()) ? "TERMINATED" : "RESIGNED"));
    }

    private void mark(String id, String status) {
        employees.findById(id).ifPresent(t -> {
            t.setStatus(status);
            employees.save(t);
        });
    }
}
