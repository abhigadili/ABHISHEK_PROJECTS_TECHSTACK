package com.hospital.notification.service;

import java.time.Instant;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.hospital.common.security.CurrentUser;
import com.hospital.common.web.ResourceNotFoundException;
import com.hospital.notification.domain.Notification;
import com.hospital.notification.domain.NotificationRepository;
import com.hospital.notification.dto.NotificationDtos.NotificationResponse;

import lombok.extern.log4j.Log4j2;

/**
 * Delivery is simulated: the message is written to the log (as an e-mail/SMS gateway would receive it) and
 * stored for audit. Swapping in a real provider only means replacing {@link #deliver(Notification)}.
 */
@Log4j2
@Service
public class NotificationService {
    private final NotificationRepository notifications;

    public NotificationService(NotificationRepository notifications) {
        this.notifications = notifications;
    }

    @Transactional
    public Notification send(String email, String phone, Notification.Channel channel, String subject, String message, String eventType, String referenceId) {
        Notification n = new Notification();
        n.setRecipientEmail(email == null ? "unknown" : email);
        n.setRecipientPhone(phone);
        n.setChannel(channel);
        n.setSubject(truncate(subject, 200));
        n.setMessage(truncate(message, 2000));
        n.setEventType(eventType);
        n.setReferenceId(referenceId);
        try {
            deliver(n);
            n.setStatus(Notification.Status.SENT);
            n.setSentAt(Instant.now());
        } catch (RuntimeException e) {
            n.setStatus(Notification.Status.FAILED);
            n.setFailureReason(truncate(e.getMessage(), 255));
            log.warn("Notification delivery failed: {}", e.toString());
        }
        return notifications.save(n);
    }

    private void deliver(Notification n) {
        if (n.getRecipientEmail() == null || n.getRecipientEmail().isBlank() || "unknown".equals(n.getRecipientEmail())) {
            throw new IllegalStateException("No recipient address");
        }
        log.info("[{} -> {}] {} | {} (event={}, ref={})", n.getChannel(), n.getRecipientEmail(), n.getSubject(), n.getMessage(), n.getEventType(), n.getReferenceId());
    }

    @Transactional(readOnly = true)
    public Page<NotificationResponse> search(String eventType, String email, int page, int size) {
        return notifications.search(blankToNull(eventType), blankToNull(email), PageRequest.of(page, Math.min(size, 100), Sort.by(Sort.Direction.DESC, "createdAt")))
                .map(NotificationResponse::from);
    }

    @Transactional(readOnly = true)
    public Page<NotificationResponse> mine(int page, int size) {
        String email = CurrentUser.email();
        if (email == null) return Page.empty();
        return notifications.findByRecipientEmailIgnoreCase(email, PageRequest.of(page, Math.min(size, 100), Sort.by(Sort.Direction.DESC, "createdAt"))).map(NotificationResponse::from);
    }

    @Transactional(readOnly = true)
    public NotificationResponse get(Long id) {
        return NotificationResponse.from(notifications.findById(id).orElseThrow(() -> new ResourceNotFoundException("Notification " + id + " not found")));
    }

    private static String truncate(String s, int max) {
        return s == null ? "" : s.length() <= max ? s : s.substring(0, max - 3) + "...";
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
