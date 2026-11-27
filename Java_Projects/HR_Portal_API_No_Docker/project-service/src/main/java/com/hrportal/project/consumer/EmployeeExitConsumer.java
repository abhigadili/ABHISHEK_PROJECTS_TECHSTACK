package com.hrportal.project.consumer;

import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

import com.hrportal.common.events.HrEvents.EmployeeExited;
import com.hrportal.common.events.HrEvents.EmployeeTerminated;
import com.hrportal.common.events.Topics;
import com.hrportal.common.kafka.IdempotentEventProcessor;
import com.hrportal.project.service.ProjectService;

/** When an employee leaves, every live project allocation ends. */
@Component
public class EmployeeExitConsumer {
    private final IdempotentEventProcessor processor;
    private final ProjectService projects;

    public EmployeeExitConsumer(IdempotentEventProcessor processor, ProjectService projects) {
        this.processor = processor;
        this.projects = projects;
    }

    @KafkaListener(topics = Topics.EMPLOYEE_EXITED, groupId = "hr-project-service")
    public void onExited(String payload) {
        processor.handle(payload, EmployeeExited.class, "project.employee-exited", e -> projects.endAllocationsOfEmployee(e.employeeId()));
    }

    @KafkaListener(topics = Topics.EMPLOYEE_TERMINATED, groupId = "hr-project-service")
    public void onTerminated(String payload) {
        processor.handle(payload, EmployeeTerminated.class, "project.employee-terminated", e -> projects.endAllocationsOfEmployee(e.employeeId()));
    }
}
