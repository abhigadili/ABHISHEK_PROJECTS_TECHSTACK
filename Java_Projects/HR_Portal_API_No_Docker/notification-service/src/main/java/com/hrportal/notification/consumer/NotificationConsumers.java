package com.hrportal.notification.consumer;

import java.time.Instant;
import java.util.Set;

import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.kafka.annotation.DltHandler;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.annotation.RetryableTopic;
import org.springframework.retry.annotation.Backoff;
import org.springframework.stereotype.Component;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hrportal.common.events.HrEvents.EmployeeCreated;
import com.hrportal.common.events.HrEvents.EmployeeUpdated;
import com.hrportal.common.events.HrEvents.NotificationRequested;
import com.hrportal.common.events.Topics;
import com.hrportal.common.kafka.IdempotentEventProcessor;
import com.hrportal.notification.entity.ContactProjection;
import com.hrportal.notification.entity.EventHistory;
import com.hrportal.notification.repository.NotificationRepositories.ContactRepository;
import com.hrportal.notification.repository.NotificationRepositories.EventHistoryRepository;
import com.hrportal.notification.service.NotificationService;

/** The three consumers of the notification service. */
public final class NotificationConsumers {
    private NotificationConsumers() {
    }

    /**
     * notification.requested -> notifications. @RetryableTopic = NON-blocking retries: a failing record moves to notification.requested-retry-0 / -1
     * (1 s then 2 s back-off) so later records are not held up, and finally to the dead-letter topic notification.requested-dlt.
     */
    @Component
    public static class RequestedConsumer {
        private static final Logger log = LoggerFactory.getLogger(RequestedConsumer.class);
        private final IdempotentEventProcessor processor;
        private final NotificationService service;

        public RequestedConsumer(IdempotentEventProcessor processor, NotificationService service) {
            this.processor = processor;
            this.service = service;
        }

        @RetryableTopic(attempts = "3", backoff = @Backoff(delay = 1000, multiplier = 2.0), exclude = IllegalArgumentException.class, autoCreateTopics = "true")
        @KafkaListener(topics = Topics.NOTIFICATION_REQUESTED, groupId = "hr-notification-service")
        public void onRequested(String payload) {
            processor.handle(payload, NotificationRequested.class, "notification.requested", service::process);
        }

        @DltHandler
        public void dead(String payload) {
            log.error("Notification request moved to the dead-letter topic (payload length {})", payload == null ? 0 : payload.length());
        }
    }

    /** Keeps the recipient address book (employeeId -> e-mail, name) current from the employee events. */
    @Component
    public static class ContactConsumer {
        private final IdempotentEventProcessor processor;
        private final ContactRepository contacts;

        public ContactConsumer(IdempotentEventProcessor processor, ContactRepository contacts) {
            this.processor = processor;
            this.contacts = contacts;
        }

        @KafkaListener(topics = Topics.EMPLOYEE_CREATED, groupId = "hr-notification-service")
        public void onCreated(String payload) {
            processor.handle(payload, EmployeeCreated.class, "notification.employee-created", e -> {
                ContactProjection c = contacts.findById(e.employeeId()).orElseGet(ContactProjection::new);
                c.setEmployeeId(e.employeeId());
                c.setFullName((e.firstName() + " " + e.lastName()).trim());
                c.setEmail(e.workEmail());
                c.setUpdatedAt(Instant.now());
                contacts.save(c);
            });
        }

        @KafkaListener(topics = Topics.EMPLOYEE_UPDATED, groupId = "hr-notification-service")
        public void onUpdated(String payload) {
            processor.handle(payload, EmployeeUpdated.class, "notification.employee-updated", e -> contacts.findById(e.employeeId()).ifPresent(c -> {
                if (e.fullName() != null) c.setFullName(e.fullName());
                if (e.workEmail() != null) c.setEmail(e.workEmail());
                c.setUpdatedAt(Instant.now());
                contacts.save(c);
            }));
        }
    }

    /** Event history: every business topic is consumed by a separate group and stored (payload redacted for topics that carry money). */
    @Component
    public static class HistoryConsumer {
        private static final Logger log = LoggerFactory.getLogger(HistoryConsumer.class);
        private static final Set<String> REDACTED = Set.of(Topics.PAYROLL_PROCESSED, Topics.SETTLEMENT_PROCESSED, Topics.NOTIFICATION_REQUESTED);
        private final EventHistoryRepository history;
        private final ObjectMapper mapper;

        public HistoryConsumer(EventHistoryRepository history, ObjectMapper mapper) {
            this.history = history;
            this.mapper = mapper;
        }

        @KafkaListener(topics = {Topics.EMPLOYEE_CREATED, Topics.EMPLOYEE_UPDATED, Topics.EMPLOYEE_TERMINATED, Topics.LEAVE_APPLIED, Topics.LEAVE_APPROVED, Topics.LEAVE_REJECTED, Topics.LEAVE_CANCELLED,
                Topics.ATTENDANCE_CHECKED_IN, Topics.ATTENDANCE_CHECKED_OUT, Topics.ATTENDANCE_CORRECTED, Topics.PAYROLL_PROCESSED, Topics.PAYSLIP_GENERATED, Topics.TAX_DECLARATION_SUBMITTED,
                Topics.TAX_DECLARATION_REVIEWED, Topics.PERFORMANCE_REVIEW_SUBMITTED, Topics.PERFORMANCE_REVIEW_APPROVED, Topics.TIMESHEET_SUBMITTED, Topics.TIMESHEET_APPROVED,
                Topics.RESIGNATION_SUBMITTED, Topics.EMPLOYEE_EXITED, Topics.SETTLEMENT_PROCESSED, Topics.HOLIDAY_CHANGED, Topics.PROJECT_ALLOCATION_CHANGED, Topics.NOTIFICATION_REQUESTED},
                groupId = "hr-notification-history")
        public void record(ConsumerRecord<String, String> rec) {
            try {
                JsonNode root = mapper.readTree(rec.value());
                JsonNode meta = root.path("metadata");
                String eventId = meta.path("eventId").asText(null);
                if (eventId == null || history.existsByEventId(eventId)) return;
                EventHistory h = new EventHistory();
                h.setEventId(eventId);
                h.setTopic(rec.topic());
                h.setEventType(meta.path("eventType").asText(null));
                h.setEmployeeId(root.hasNonNull("employeeId") ? root.get("employeeId").asText() : null);
                h.setSourceService(meta.path("sourceService").asText(null));
                h.setCorrelationId(meta.path("correlationId").asText(null));
                h.setOccurredAt(meta.hasNonNull("timestamp") ? Instant.parse(meta.get("timestamp").asText()) : Instant.ofEpochMilli(rec.timestamp()));
                h.setPartitionNo(rec.partition());
                h.setOffsetNo(rec.offset());
                h.setPayload(REDACTED.contains(rec.topic()) ? "{\"redacted\":true}" : rec.value());
                history.save(h);
            } catch (DataIntegrityViolationException dup) {
                log.debug("Event already recorded");
            } catch (Exception e) {
                log.warn("Event history could not record {}-{}@{}: {}", rec.topic(), rec.partition(), rec.offset(), e.toString());
            }
        }
    }
}
