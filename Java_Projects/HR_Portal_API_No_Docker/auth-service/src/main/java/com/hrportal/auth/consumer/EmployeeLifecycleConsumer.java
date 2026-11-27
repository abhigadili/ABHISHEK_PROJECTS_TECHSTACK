package com.hrportal.auth.consumer;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

import com.hrportal.auth.service.UserAdminService;
import com.hrportal.common.events.HrEvents.EmployeeCreated;
import com.hrportal.common.events.HrEvents.EmployeeExited;
import com.hrportal.common.events.HrEvents.EmployeeTerminated;
import com.hrportal.common.events.Topics;
import com.hrportal.common.kafka.IdempotentEventProcessor;

/** Consumes employee lifecycle events: provisions an account on hire, deactivates it on termination / exit. */
@Component
public class EmployeeLifecycleConsumer {
    private static final Logger log = LoggerFactory.getLogger(EmployeeLifecycleConsumer.class);
    private final IdempotentEventProcessor processor;
    private final UserAdminService users;

    public EmployeeLifecycleConsumer(IdempotentEventProcessor processor, UserAdminService users) {
        this.processor = processor;
        this.users = users;
    }

    @KafkaListener(topics = Topics.EMPLOYEE_CREATED, groupId = "hr-auth-service")
    public void onCreated(String payload) {
        processor.handle(payload, EmployeeCreated.class, "auth.employee-created", e ->
                users.provisionForEmployee(e.employeeId(), e.employeeCode(), e.workEmail(), e.firstName()));
    }

    @KafkaListener(topics = Topics.EMPLOYEE_TERMINATED, groupId = "hr-auth-service")
    public void onTerminated(String payload) {
        processor.handle(payload, EmployeeTerminated.class, "auth.employee-terminated", e ->
                users.deactivateByEmployee(e.employeeId(), "TERMINATED"));
    }

    @KafkaListener(topics = Topics.EMPLOYEE_EXITED, groupId = "hr-auth-service")
    public void onExited(String payload) {
        processor.handle(payload, EmployeeExited.class, "auth.employee-exited", e -> {
            log.info("Employee {} exited - revoking access", e.employeeId());
            users.deactivateByEmployee(e.employeeId(), "EXITED");
        });
    }
}
