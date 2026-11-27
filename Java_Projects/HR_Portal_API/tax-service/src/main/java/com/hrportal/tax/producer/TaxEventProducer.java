package com.hrportal.tax.producer;

import java.util.Map;

import org.springframework.stereotype.Component;

import com.hrportal.common.events.EventMetadata;
import com.hrportal.common.events.HrEvents.NotificationRequested;
import com.hrportal.common.events.HrEvents.TaxDeclarationReviewed;
import com.hrportal.common.events.HrEvents.TaxDeclarationSubmitted;
import com.hrportal.common.events.Topics;
import com.hrportal.common.kafka.EventPublisher;
import com.hrportal.tax.entity.TaxDeclaration;

@Component
public class TaxEventProducer {
    private final EventPublisher publisher;

    public TaxEventProducer(EventPublisher publisher) {
        this.publisher = publisher;
    }

    public void submitted(TaxDeclaration d) {
        publisher.publish(Topics.TAX_DECLARATION_SUBMITTED, d.getEmployeeId(), new TaxDeclarationSubmitted(EventMetadata.of(Topics.TAX_DECLARATION_SUBMITTED), d.getEmployeeId(),
                d.getId(), d.getFinancialYear(), d.getRegime().name(), d.getTotalDeclared()));
    }

    public void reviewed(TaxDeclaration d, String decision, String reviewerId, String comment) {
        publisher.publish(Topics.TAX_DECLARATION_REVIEWED, d.getEmployeeId(), new TaxDeclarationReviewed(EventMetadata.of(Topics.TAX_DECLARATION_REVIEWED), d.getEmployeeId(),
                d.getId(), d.getFinancialYear(), decision, reviewerId, comment));
        notify(d.getEmployeeId(), "TAX_DECLARATION_" + decision, d.getId(), Map.of("financialYear", d.getFinancialYear(), "comment", comment == null ? "" : comment), "taxdecl:" + d.getId() + ":" + decision + ":" + d.getVersion());
    }

    public void notify(String employeeId, String template, String refId, Map<String, String> params, String dedupKey) {
        publisher.publish(Topics.NOTIFICATION_REQUESTED, employeeId, NotificationRequested.of(employeeId, null, template, template, params, "TAX", refId, dedupKey));
    }
}
