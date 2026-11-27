package com.hrportal.employee.consumer;

import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

import com.hrportal.common.events.HrEvents.EmployeeExited;
import com.hrportal.common.events.HrEvents.ResignationSubmitted;
import com.hrportal.common.events.Topics;
import com.hrportal.common.kafka.IdempotentEventProcessor;
import com.hrportal.employee.entity.Enums.EmployeeStatus;
import com.hrportal.employee.service.EmployeeService;

/** Exit workflow -> employee status: resignation puts the employee ON_NOTICE, completed exit makes them RESIGNED / TERMINATED. */
@Component
public class ExitEventsConsumer {
    private final IdempotentEventProcessor processor;
    private final EmployeeService employees;

    public ExitEventsConsumer(IdempotentEventProcessor processor, EmployeeService employees) {
        this.processor = processor;
        this.employees = employees;
    }

    @KafkaListener(topics = Topics.RESIGNATION_SUBMITTED, groupId = "hr-employee-service")
    public void onResignation(String payload) {
        processor.handle(payload, ResignationSubmitted.class, "employee.resignation-submitted", e ->
                employees.applyExitState(e.employeeId(), EmployeeStatus.ON_NOTICE, null));
    }

    @KafkaListener(topics = Topics.EMPLOYEE_EXITED, groupId = "hr-employee-service")
    public void onExited(String payload) {
        processor.handle(payload, EmployeeExited.class, "employee.exited", e -> {
            EmployeeStatus status = "TERMINATED".equals(e.exitType()) ? EmployeeStatus.TERMINATED : EmployeeStatus.RESIGNED;
            employees.applyExitState(e.employeeId(), status, e.lastWorkingDay());
        });
    }
}
