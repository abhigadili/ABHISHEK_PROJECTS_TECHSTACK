package com.studentmgmt.notification.command.repository;

import com.studentmgmt.notification.command.entity.Notification;
import org.springframework.data.jpa.repository.JpaRepository;

public interface NotificationCommandRepository extends JpaRepository<Notification, Long> {
}
