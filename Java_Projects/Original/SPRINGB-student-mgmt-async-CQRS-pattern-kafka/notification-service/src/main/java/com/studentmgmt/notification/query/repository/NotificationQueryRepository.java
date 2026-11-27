package com.studentmgmt.notification.query.repository;

import com.studentmgmt.notification.query.entity.NotificationView;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface NotificationQueryRepository extends JpaRepository<NotificationView, Long> {

    List<NotificationView> findByRecipientId(Long recipientId);

    List<NotificationView> findByEnrollmentId(Long enrollmentId);
}
