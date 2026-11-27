package com.hrportal.project.producer;

import java.util.Map;

import org.springframework.stereotype.Component;

import com.hrportal.common.events.EventMetadata;
import com.hrportal.common.events.HrEvents.NotificationRequested;
import com.hrportal.common.events.HrEvents.ProjectAllocationChanged;
import com.hrportal.common.events.Topics;
import com.hrportal.common.kafka.EventPublisher;
import com.hrportal.project.entity.Project;
import com.hrportal.project.entity.ProjectAllocation;

@Component
public class ProjectEventProducer {
    private final EventPublisher publisher;

    public ProjectEventProducer(EventPublisher publisher) {
        this.publisher = publisher;
    }

    public void allocationChanged(Project p, ProjectAllocation a, String action) {
        publisher.publish(Topics.PROJECT_ALLOCATION_CHANGED, a.getEmployeeId(), new ProjectAllocationChanged(EventMetadata.of(Topics.PROJECT_ALLOCATION_CHANGED),
                a.getEmployeeId(), p.getId(), p.getName(), a.getAllocationPercent(), action, a.getStartDate(), a.getEndDate()));
        if ("CREATED".equals(action)) {
            publisher.publish(Topics.NOTIFICATION_REQUESTED, a.getEmployeeId(), NotificationRequested.of(a.getEmployeeId(), null, "PROJECT_ALLOCATED", "PROJECT_ALLOCATED",
                    Map.of("project", p.getName(), "role", a.getRole(), "percent", a.getAllocationPercent().toPlainString(), "from", a.getStartDate().toString()),
                    "PROJECT", p.getId(), "alloc:" + a.getId()));
        }
    }
}
