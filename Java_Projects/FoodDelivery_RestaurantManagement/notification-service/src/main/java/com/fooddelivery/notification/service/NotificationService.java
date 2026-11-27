package com.fooddelivery.notification.service;

import com.fooddelivery.common.exception.ForbiddenException;
import com.fooddelivery.common.exception.NotFoundException;
import com.fooddelivery.common.security.SecurityUtils;
import com.fooddelivery.common.web.Correlation;
import com.fooddelivery.notification.channel.NotificationChannel;
import com.fooddelivery.notification.client.ContactGateway;
import com.fooddelivery.notification.client.UserContactClient;
import com.fooddelivery.notification.domain.Notification;
import com.fooddelivery.notification.repository.NotificationRepository;
import com.fooddelivery.notification.web.Dtos;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Delivery of notifications. One request creates an IN_APP row plus (when the user can be reached and the channel is
 * enabled) an EMAIL and an SMS row, each handled by its own {@link NotificationChannel} adapter.
 */
@Service
public class NotificationService {
    private static final Logger log = LoggerFactory.getLogger(NotificationService.class);
    private final NotificationRepository repo;
    private final ContactGateway contacts;
    private final List<NotificationChannel> channels;

    public NotificationService(NotificationRepository repo, ContactGateway contacts, List<NotificationChannel> channels) {
        this.repo = repo;
        this.contacts = contacts;
        this.channels = channels;
    }

    /** @param refType e.g. "ORDER"; @param refId the order id (so the UI can link to it) */
    @Transactional
    public void notifyUser(long userId, String title, String message, String type, String refType, Long refId) {
        if (userId <= 0) return;
        UserContactClient.Contact contact = null;
        boolean needContact = channels.stream().anyMatch(c -> c.channel() != Notification.Channel.IN_APP && c.enabled());
        if (needContact) contact = contacts.contact(userId);
        for (NotificationChannel ch : channels) {
            if (!ch.enabled() || !ch.canReach(contact)) continue;
            Notification n = new Notification();
            n.setUserId(userId);
            n.setTitle(trim(title, 150));
            n.setMessage(trim(message, 1000));
            n.setType(type);
            n.setChannel(ch.channel());
            n.setReferenceType(refType);
            n.setReferenceId(refId);
            n.setCorrelationId(Correlation.current());
            repo.saveAndFlush(n);
            try {
                var r = ch.deliver(n, contact);
                n.setStatus(r.sent() ? Notification.Status.SENT : Notification.Status.FAILED);
                n.setProviderRef(r.providerRef());
                n.setError(r.error());
                if (r.sent()) n.setSentAt(Instant.now());
            } catch (RuntimeException ex) {
                n.setStatus(Notification.Status.FAILED);
                n.setError(trim(ex.getMessage(), 290));
                log.warn("Notification channel {} failed for user {}: {}", ch.channel(), userId, ex.getMessage());
            }
        }
        log.info("Notification '{}' dispatched to user {}", type, userId);
    }

    @Transactional(readOnly = true)
    public Page<Dtos.NotificationDto> mine(boolean unreadOnly, int page, int size) {
        long me = SecurityUtils.requireUser().userId();
        var pr = PageRequest.of(page, Math.min(size, 100));
        return (unreadOnly ? repo.findByUserIdAndChannelAndReadFlagFalseOrderByCreatedAtDesc(me, Notification.Channel.IN_APP, pr)
                : repo.findByUserIdAndChannelOrderByCreatedAtDesc(me, Notification.Channel.IN_APP, pr)).map(Dtos.NotificationDto::from);
    }

    @Transactional(readOnly = true)
    public long unread() { return repo.countByUserIdAndChannelAndReadFlagFalse(SecurityUtils.requireUser().userId(), Notification.Channel.IN_APP); }

    @Transactional
    public Dtos.NotificationDto markRead(Long id) {
        Notification n = repo.findById(id).orElseThrow(() -> new NotFoundException("Notification", id));
        if (n.getUserId() != SecurityUtils.requireUser().userId()) throw new ForbiddenException("Not your notification");
        if (!n.isReadFlag()) { n.setReadFlag(true); n.setReadAt(Instant.now()); }
        return Dtos.NotificationDto.from(n);
    }

    @Transactional
    public int markAllRead() { return repo.markAllRead(SecurityUtils.requireUser().userId(), Instant.now()); }

    @Transactional(readOnly = true)
    public Page<Dtos.NotificationDto> history(Long userId, int page, int size) {
        var pr = PageRequest.of(page, Math.min(size, 100));
        return (userId == null ? repo.findAllByOrderByCreatedAtDesc(pr) : repo.findByUserIdOrderByCreatedAtDesc(userId, pr)).map(Dtos.NotificationDto::from);
    }

    @Transactional(readOnly = true)
    public Dtos.Stats stats() {
        Map<String, Long> m = new LinkedHashMap<>();
        for (Object[] r : repo.stats()) m.put(r[0] + "/" + r[1], (Long) r[2]);
        return new Dtos.Stats(m);
    }

    private static String trim(String s, int max) { return s == null ? "" : s.length() <= max ? s : s.substring(0, max); }
}
