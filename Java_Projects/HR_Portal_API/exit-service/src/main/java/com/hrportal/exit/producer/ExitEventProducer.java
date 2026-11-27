package com.hrportal.exit.producer;

import java.math.BigDecimal;
import java.util.Map;

import org.springframework.stereotype.Component;

import com.hrportal.common.events.EventMetadata;
import com.hrportal.common.events.HrEvents.EmployeeExited;
import com.hrportal.common.events.HrEvents.NotificationRequested;
import com.hrportal.common.events.HrEvents.ResignationSubmitted;
import com.hrportal.common.events.HrEvents.SettlementProcessed;
import com.hrportal.common.events.Topics;
import com.hrportal.common.kafka.EventPublisher;
import com.hrportal.exit.entity.Resignation;

@Component
public class ExitEventProducer {
    private final EventPublisher publisher;

    public ExitEventProducer(EventPublisher publisher) {
        this.publisher = publisher;
    }

    public void submitted(Resignation r) {
        publisher.publish(Topics.RESIGNATION_SUBMITTED, r.getEmployeeId(), new ResignationSubmitted(EventMetadata.of(Topics.RESIGNATION_SUBMITTED), r.getEmployeeId(), r.getId(),
                r.getManagerId(), r.getRequestedLastWorkingDay(), r.getNoticePeriodDays(), r.getReason()));
    }

    public void exited(Resignation r) {
        publisher.publish(Topics.EMPLOYEE_EXITED, r.getEmployeeId(), new EmployeeExited(EventMetadata.of(Topics.EMPLOYEE_EXITED), r.getEmployeeId(), r.getId(),
                r.getConfirmedLastWorkingDay(), "RESIGNED"));
    }

    public void settlementProcessed(Resignation r, BigDecimal net, String reference) {
        publisher.publish(Topics.SETTLEMENT_PROCESSED, r.getEmployeeId(), new SettlementProcessed(EventMetadata.of(Topics.SETTLEMENT_PROCESSED), r.getEmployeeId(), r.getId(), net, reference));
    }

    public void notify(String recipientEmployeeId, String template, Resignation r, Map<String, String> extra, String stateKey) {
        if (recipientEmployeeId == null) return;
        java.util.Map<String, String> params = new java.util.HashMap<>(extra);
        params.put("employeeName", String.valueOf(r.getEmployeeName()));
        params.putIfAbsent("lastWorkingDay", String.valueOf(r.getConfirmedLastWorkingDay() == null ? r.getRequestedLastWorkingDay() : r.getConfirmedLastWorkingDay()));
        params.putIfAbsent("comment", "");
        publisher.publish(Topics.NOTIFICATION_REQUESTED, recipientEmployeeId, NotificationRequested.of(recipientEmployeeId, null, template, template, params, "RESIGNATION", r.getId(),
                template + ":" + r.getId() + ":" + recipientEmployeeId + ":" + stateKey));
    }
}
