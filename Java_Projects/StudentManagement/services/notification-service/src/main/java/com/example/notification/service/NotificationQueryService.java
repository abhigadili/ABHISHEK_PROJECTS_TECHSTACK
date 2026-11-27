package com.example.notification.service;

import com.example.common.exception.BusinessRuleException;
import com.example.common.exception.ResourceNotFoundException;
import com.example.notification.dto.NotificationResponse;
import com.example.notification.entity.Notification;
import com.example.notification.entity.NotificationStatus;
import com.example.notification.entity.NotificationType;
import com.example.notification.mapper.NotificationMapper;
import com.example.notification.repository.NotificationRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class NotificationQueryService {
    private final NotificationRepository repository;
    private final NotificationMapper mapper;

    public NotificationQueryService(NotificationRepository repository, NotificationMapper mapper) {
        this.repository = repository; this.mapper = mapper;
    }

    @Transactional(readOnly = true)
    public Page<NotificationResponse> search(Long studentId, NotificationStatus status, NotificationType type, Pageable pageable) {
        return repository.search(studentId, status, type, pageable).map(mapper::toResponse);
    }

    @Transactional(readOnly = true)
    public NotificationResponse get(Long id) { return mapper.toResponse(find(id)); }

    @Transactional(readOnly = true)
    public Page<NotificationResponse> forStudent(Long studentId, Pageable pageable) {
        return repository.findByStudentId(studentId, pageable).map(mapper::toResponse);
    }

    /** Manual retry of a FAILED notification. */
    @Transactional
    public NotificationResponse retry(Long id) {
        Notification n = find(id);
        if (n.getStatus() != NotificationStatus.FAILED) throw new BusinessRuleException("Only FAILED notifications can be retried (current: " + n.getStatus() + ")");
        n.setStatus(NotificationStatus.PENDING);
        n.setRetryCount(0);
        n.setNextAttemptAt(null);
        n.setProcessedAt(null);
        return mapper.toResponse(repository.save(n));
    }

    private Notification find(Long id) { return repository.findById(id).orElseThrow(() -> new ResourceNotFoundException("Notification " + id + " not found")); }
}
