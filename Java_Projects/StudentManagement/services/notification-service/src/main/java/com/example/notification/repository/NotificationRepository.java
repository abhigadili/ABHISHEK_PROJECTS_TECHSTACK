package com.example.notification.repository;

import com.example.notification.entity.Notification;
import com.example.notification.entity.NotificationStatus;
import com.example.notification.entity.NotificationType;
import java.time.LocalDateTime;
import java.util.List;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface NotificationRepository extends JpaRepository<Notification, Long> {
    boolean existsByEnrollmentIdAndNotificationType(Long enrollmentId, NotificationType type);

    @Query("select n from Notification n where n.status = :status and (n.nextAttemptAt is null or n.nextAttemptAt <= :now) order by n.notificationId")
    List<Notification> findDue(@Param("status") NotificationStatus status, @Param("now") LocalDateTime now, Pageable pageable);

    @Query("select n from Notification n where (:studentId is null or n.studentId = :studentId) "
            + "and (:status is null or n.status = :status) and (:type is null or n.notificationType = :type)")
    Page<Notification> search(@Param("studentId") Long studentId, @Param("status") NotificationStatus status,
                              @Param("type") NotificationType type, Pageable pageable);

    Page<Notification> findByStudentId(Long studentId, Pageable pageable);
}
