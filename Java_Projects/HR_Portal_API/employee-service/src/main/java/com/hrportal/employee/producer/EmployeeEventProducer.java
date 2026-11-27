package com.hrportal.employee.producer;

import java.time.LocalDate;
import java.util.List;

import org.springframework.stereotype.Component;

import com.hrportal.common.events.EventMetadata;
import com.hrportal.common.events.HrEvents.EmployeeCreated;
import com.hrportal.common.events.HrEvents.EmployeeTerminated;
import com.hrportal.common.events.HrEvents.EmployeeUpdated;
import com.hrportal.common.events.Topics;
import com.hrportal.common.kafka.EventPublisher;
import com.hrportal.employee.entity.Employee;

/** Producer for the employee.* topics (events go through the transactional outbox). Key = employee id, so one employee's events stay ordered. */
@Component
public class EmployeeEventProducer {
    private final EventPublisher publisher;

    public EmployeeEventProducer(EventPublisher publisher) {
        this.publisher = publisher;
    }

    public void created(Employee e) {
        publisher.publish(Topics.EMPLOYEE_CREATED, e.getId(), new EmployeeCreated(EventMetadata.of(Topics.EMPLOYEE_CREATED), e.getId(),
                e.getEmployeeCode(), e.getFirstName(), e.getLastName(), e.getWorkEmail(), e.getDepartmentId(), e.getDesignationId(),
                e.getLocationId(), e.getManagerId(), e.getJobGradeId(), e.getJoiningDate(), e.getStatus().name()));
    }

    public void updated(Employee e, List<String> changedFields) {
        publisher.publish(Topics.EMPLOYEE_UPDATED, e.getId(), new EmployeeUpdated(EventMetadata.of(Topics.EMPLOYEE_UPDATED), e.getId(),
                e.getEmployeeCode(), e.getFullName(), e.getWorkEmail(), e.getDepartmentId(), e.getDesignationId(), e.getLocationId(),
                e.getManagerId(), e.getStatus().name(), changedFields));
    }

    public void terminated(Employee e, String reason, LocalDate effectiveDate) {
        publisher.publish(Topics.EMPLOYEE_TERMINATED, e.getId(), new EmployeeTerminated(EventMetadata.of(Topics.EMPLOYEE_TERMINATED),
                e.getId(), e.getEmployeeCode(), e.getStatus().name(), reason, effectiveDate));
    }
}
