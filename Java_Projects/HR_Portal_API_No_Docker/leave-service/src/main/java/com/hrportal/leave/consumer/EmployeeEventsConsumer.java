package com.hrportal.leave.consumer;

import java.time.Instant;
import java.time.LocalDate;

import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

import com.hrportal.common.events.HrEvents.EmployeeCreated;
import com.hrportal.common.events.HrEvents.EmployeeExited;
import com.hrportal.common.events.HrEvents.EmployeeTerminated;
import com.hrportal.common.events.HrEvents.EmployeeUpdated;
import com.hrportal.common.events.Topics;
import com.hrportal.common.kafka.IdempotentEventProcessor;
import com.hrportal.leave.entity.LeaveEmployee;
import com.hrportal.leave.repository.LeaveRepositories.LeaveEmployeeRepository;
import com.hrportal.leave.service.LeaveBalanceService;

/** Keeps the local employee facts current and creates the first-year balances when somebody joins. */
@Component
public class EmployeeEventsConsumer {
    private final IdempotentEventProcessor processor;
    private final LeaveEmployeeRepository employees;
    private final LeaveBalanceService balances;

    public EmployeeEventsConsumer(IdempotentEventProcessor processor, LeaveEmployeeRepository employees, LeaveBalanceService balances) {
        this.processor = processor;
        this.employees = employees;
        this.balances = balances;
    }

    @KafkaListener(topics = Topics.EMPLOYEE_CREATED, groupId = "hr-leave-service")
    public void onCreated(String payload) {
        processor.handle(payload, EmployeeCreated.class, "leave.employee-created", e -> {
            LeaveEmployee le = employees.findById(e.employeeId()).orElseGet(LeaveEmployee::new);
            le.setEmployeeId(e.employeeId());
            le.setFullName((e.firstName() + " " + e.lastName()).trim());
            le.setJoiningDate(e.joiningDate());
            le.setManagerId(e.managerId());
            le.setDepartmentId(e.departmentId());
            le.setLocationId(e.locationId());
            le.setStatus(e.status() == null ? "ACTIVE" : e.status());
            le.setUpdatedAt(Instant.now());
            employees.save(le);
            balances.initialise(le, e.joiningDate() != null && e.joiningDate().getYear() > LocalDate.now().getYear() ? e.joiningDate().getYear() : LocalDate.now().getYear());
        });
    }

    @KafkaListener(topics = Topics.EMPLOYEE_UPDATED, groupId = "hr-leave-service")
    public void onUpdated(String payload) {
        processor.handle(payload, EmployeeUpdated.class, "leave.employee-updated", e -> employees.findById(e.employeeId()).ifPresent(le -> {
            if (e.fullName() != null) le.setFullName(e.fullName());
            le.setManagerId(e.managerId());
            le.setDepartmentId(e.departmentId());
            le.setLocationId(e.locationId());
            if (e.status() != null) le.setStatus(e.status());
            le.setUpdatedAt(Instant.now());
            employees.save(le);
        }));
    }

    @KafkaListener(topics = Topics.EMPLOYEE_TERMINATED, groupId = "hr-leave-service")
    public void onTerminated(String payload) {
        processor.handle(payload, EmployeeTerminated.class, "leave.employee-terminated", e -> mark(e.employeeId(), "TERMINATED"));
    }

    @KafkaListener(topics = Topics.EMPLOYEE_EXITED, groupId = "hr-leave-service")
    public void onExited(String payload) {
        processor.handle(payload, EmployeeExited.class, "leave.employee-exited", e -> mark(e.employeeId(), "TERMINATED".equals(e.exitType()) ? "TERMINATED" : "RESIGNED"));
    }

    private void mark(String employeeId, String status) {
        employees.findById(employeeId).ifPresent(le -> {
            le.setStatus(status);
            le.setUpdatedAt(Instant.now());
            employees.save(le);
        });
    }
}
