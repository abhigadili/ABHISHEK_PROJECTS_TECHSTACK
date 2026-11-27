package com.hrportal.document.producer;

import java.util.Map;

import org.springframework.stereotype.Component;

import com.hrportal.common.events.HrEvents.NotificationRequested;
import com.hrportal.common.events.Topics;
import com.hrportal.common.kafka.EventPublisher;
import com.hrportal.document.entity.Document;

@Component
public class DocumentEventProducer {
    private final EventPublisher publisher;

    public DocumentEventProducer(EventPublisher publisher) {
        this.publisher = publisher;
    }

    public void notifyOwner(Document d, String template, String reason) {
        publisher.publish(Topics.NOTIFICATION_REQUESTED, d.getOwnerEmployeeId(), NotificationRequested.of(d.getOwnerEmployeeId(), null, template, template,
                Map.of("title", d.getTitle(), "reason", reason == null ? "" : reason), "DOCUMENT", d.getId(), template + ":" + d.getId()));
    }

    public void expiring(Document d, String isoDate) {
        publisher.publish(Topics.NOTIFICATION_REQUESTED, d.getOwnerEmployeeId(), NotificationRequested.of(d.getOwnerEmployeeId(), null, "DOCUMENT_EXPIRING", "DOCUMENT_EXPIRING",
                Map.of("title", d.getTitle(), "expiryDate", String.valueOf(d.getExpiryDate())), "DOCUMENT", d.getId(), "doc-expiry:" + d.getId() + ":" + isoDate));
    }
}
