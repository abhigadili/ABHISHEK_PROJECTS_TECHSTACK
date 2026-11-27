package com.hrportal.notification.service;

import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import com.hrportal.common.events.EventMetadata;
import com.hrportal.common.events.HrEvents.NotificationRequested;
import com.hrportal.common.exception.ForbiddenOperationException;
import com.hrportal.common.exception.ResourceNotFoundException;
import com.hrportal.common.persistence.BeanMapper;
import com.hrportal.common.security.CurrentUser;
import com.hrportal.notification.dto.NotificationDtos.NotificationResponse;
import com.hrportal.notification.dto.NotificationDtos.SendRequest;
import com.hrportal.notification.entity.ContactProjection;
import com.hrportal.notification.entity.Enums.Channel;
import com.hrportal.notification.entity.Enums.DeliveryStatus;
import com.hrportal.notification.entity.Notification;
import com.hrportal.notification.entity.NotificationTemplate;
import com.hrportal.notification.queue.EmailDispatchQueue;
import com.hrportal.notification.queue.EmailDispatchQueue.Job;
import com.hrportal.notification.repository.NotificationRepositories.ContactRepository;
import com.hrportal.notification.repository.NotificationRepositories.NotificationRepository;
import com.hrportal.notification.repository.NotificationRepositories.TemplateRepository;

/**
 * Turns a NotificationRequested event into notifications: Redis de-duplication (SET NX with a 24 h TTL on the dedup key), template rendering,
 * one IN_APP row (delivered immediately) and one EMAIL row handed to the dispatch queue AFTER the transaction commits.
 */
@Service
public class NotificationService {
    private static final Logger log = LoggerFactory.getLogger(NotificationService.class);
    private static final Pattern PLACEHOLDER = Pattern.compile("\\{\\{\\s*([A-Za-z0-9_]+)\\s*}}");
    /** Parameters that are masked in the STORED body (they are still used in the delivered e-mail). */
    private static final Set<String> SENSITIVE_PARAMS = Set.of("token", "password", "otp");
    private static final Duration DEDUP_TTL = Duration.ofHours(24);

    private final NotificationRepository notifications;
    private final TemplateRepository templates;
    private final ContactRepository contacts;
    private final StringRedisTemplate redis;
    private final EmailDispatchQueue emailQueue;

    public NotificationService(NotificationRepository notifications, TemplateRepository templates, ContactRepository contacts, StringRedisTemplate redis, EmailDispatchQueue emailQueue) {
        this.notifications = notifications;
        this.templates = templates;
        this.contacts = contacts;
        this.redis = redis;
        this.emailQueue = emailQueue;
    }

    @Transactional
    public void process(NotificationRequested e) {
        if (e.dedupKey() != null && !firstTime(e.dedupKey())) {
            log.info("Duplicate notification suppressed (dedupKey={})", e.dedupKey());
            return;
        }
        ContactProjection contact = e.employeeId() == null ? null : contacts.findById(e.employeeId()).orElse(null);
        String email = e.recipientEmail() != null ? e.recipientEmail() : contact == null ? null : contact.getEmail();
        Map<String, String> params = new HashMap<>(e.params() == null ? Map.of() : e.params());
        if (contact != null) params.putIfAbsent("name", contact.getFullName() == null ? "" : contact.getFullName());
        NotificationTemplate t = templates.findByCodeAndActiveTrue(e.templateCode()).orElse(null);
        String subject = render(t == null ? "Notification: " + e.type() : t.getSubjectTemplate(), params, false);
        String deliveryBody = render(t == null ? fallbackBody(e.type(), params) : t.getBodyTemplate(), params, false);
        String storedBody = render(t == null ? fallbackBody(e.type(), params) : t.getBodyTemplate(), params, true);
        List<String> channels = e.channels() == null || e.channels().isEmpty() ? List.of("IN_APP", "EMAIL") : e.channels();
        String cid = e.metadata() == null ? MDC.get("correlationId") : e.metadata().correlationId();
        if (channels.contains("IN_APP") && e.employeeId() != null) {
            Notification n = base(e, Channel.IN_APP, subject, storedBody, cid);
            n.setRecipientEmployeeId(e.employeeId());
            n.setStatus(DeliveryStatus.SENT);
            n.setSentAt(Instant.now());
            notifications.save(n);
        }
        if (channels.contains("EMAIL")) {
            Notification n = base(e, Channel.EMAIL, subject, storedBody, cid);
            n.setRecipientEmployeeId(e.employeeId());
            n.setRecipientEmail(email);
            if (email == null) {
                n.setStatus(DeliveryStatus.SKIPPED);
                n.setErrorMessage("No e-mail address known for the recipient");
                notifications.save(n);
            } else {
                Notification saved = notifications.save(n);
                Job job = new Job(saved.getId(), email, subject, deliveryBody);
                // hand over only after commit, otherwise the worker could look the row up before it exists
                if (TransactionSynchronizationManager.isSynchronizationActive()) {
                    TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                        @Override
                        public void afterCommit() {
                            emailQueue.offer(job);
                        }
                    });
                } else {
                    emailQueue.offer(job);
                }
            }
        }
    }

    /** HR / admin ad-hoc message to one employee (goes through the same pipeline). */
    @Transactional
    public void sendManual(SendRequest req) {
        process(new NotificationRequested(EventMetadata.of("notification.requested"), req.employeeId(), null, "MANUAL", "MANUAL_MESSAGE",
                Map.of("subject", req.subject(), "message", req.message()), req.channels(), "MANUAL", null, null));
    }

    // ------------------------------------------------------------------ inbox
    @Transactional(readOnly = true)
    public Page<NotificationResponse> inbox(boolean unreadOnly, Pageable pageable) {
        String me = requireEmployee();
        Page<Notification> page = unreadOnly ? notifications.findByRecipientEmployeeIdAndChannelAndReadAtIsNull(me, Channel.IN_APP, pageable)
                : notifications.findByRecipientEmployeeIdAndChannel(me, Channel.IN_APP, pageable);
        return page.map(n -> BeanMapper.toRecord(n, NotificationResponse.class));
    }

    @Transactional(readOnly = true)
    public long unreadCount() {
        return notifications.countByRecipientEmployeeIdAndChannelAndReadAtIsNull(requireEmployee(), Channel.IN_APP);
    }

    @Transactional
    public NotificationResponse markRead(String id) {
        Notification n = notifications.findById(id).orElseThrow(() -> ResourceNotFoundException.of("Notification", id));
        if (!n.getRecipientEmployeeId().equals(CurrentUser.employeeId())) throw new ForbiddenOperationException("Not your notification");
        if (n.getReadAt() == null) n.setReadAt(Instant.now());
        return BeanMapper.toRecord(notifications.save(n), NotificationResponse.class);
    }

    @Transactional
    public int markAllRead() {
        return notifications.markAllRead(requireEmployee(), Instant.now());
    }

    @Transactional(readOnly = true)
    public Page<NotificationResponse> history(String employeeId, String type, String status, Pageable pageable) {
        DeliveryStatus s = status == null || status.isBlank() ? null : DeliveryStatus.valueOf(status.toUpperCase());
        return notifications.search(employeeId, type, s, pageable).map(n -> BeanMapper.toRecord(n, NotificationResponse.class));
    }

    // ------------------------------------------------------------------ rendering / dedup
    /** SET key NX EX 24h: returns true only for the first caller. If Redis is down we allow the notification (better twice than never). */
    private boolean firstTime(String key) {
        try {
            return Boolean.TRUE.equals(redis.opsForValue().setIfAbsent("hr:notif:dedup:" + key, "1", DEDUP_TTL));
        } catch (RuntimeException ex) {
            log.warn("Notification dedup unavailable: {}", ex.toString());
            return true;
        }
    }

    static String render(String template, Map<String, String> params, boolean maskSensitive) {
        Matcher m = PLACEHOLDER.matcher(template);
        StringBuilder sb = new StringBuilder();
        while (m.find()) {
            String key = m.group(1);
            String value = params.getOrDefault(key, "");
            if (maskSensitive && SENSITIVE_PARAMS.contains(key.toLowerCase())) value = "********";
            m.appendReplacement(sb, Matcher.quoteReplacement(value));
        }
        m.appendTail(sb);
        String out = sb.toString();
        return out.length() > 1990 ? out.substring(0, 1990) : out;
    }

    private static String fallbackBody(String type, Map<String, String> params) {
        StringBuilder sb = new StringBuilder("You have a new notification (" + type + ").");
        params.forEach((k, v) -> {
            if (!SENSITIVE_PARAMS.contains(k.toLowerCase())) sb.append("\n").append(k).append(": ").append(v);
        });
        return sb.toString();
    }

    private Notification base(NotificationRequested e, Channel channel, String subject, String body, String cid) {
        Notification n = new Notification();
        n.setChannel(channel);
        n.setType(e.type());
        n.setSubject(subject.length() > 190 ? subject.substring(0, 190) : subject);
        n.setBody(body);
        n.setReferenceType(e.referenceType());
        n.setReferenceId(e.referenceId());
        n.setCorrelationId(cid);
        return n;
    }

    private static String requireEmployee() {
        String me = CurrentUser.employeeId();
        if (me == null) throw new ForbiddenOperationException("Your account is not linked to an employee record");
        return me;
    }
}
