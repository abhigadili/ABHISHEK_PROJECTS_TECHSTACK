package com.hospital.notification.domain;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface NotificationRepository extends JpaRepository<Notification, Long> {
    Page<Notification> findByRecipientEmailIgnoreCase(String email, Pageable pageable);

    @Query("""
            select n from Notification n
            where (:eventType is null or n.eventType = :eventType)
              and (:email is null or lower(n.recipientEmail) = lower(:email))
            """)
    Page<Notification> search(@Param("eventType") String eventType, @Param("email") String email, Pageable pageable);
}
