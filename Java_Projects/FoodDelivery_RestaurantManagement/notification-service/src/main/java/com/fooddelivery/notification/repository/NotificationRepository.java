package com.fooddelivery.notification.repository;

import com.fooddelivery.notification.domain.Notification;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.time.Instant;
import java.util.List;

public interface NotificationRepository extends JpaRepository<Notification, Long> {
    Page<Notification> findByUserIdAndChannelOrderByCreatedAtDesc(Long userId, Notification.Channel channel, Pageable p);
    Page<Notification> findByUserIdAndChannelAndReadFlagFalseOrderByCreatedAtDesc(Long userId, Notification.Channel channel, Pageable p);
    long countByUserIdAndChannelAndReadFlagFalse(Long userId, Notification.Channel channel);
    Page<Notification> findByUserIdOrderByCreatedAtDesc(Long userId, Pageable p);
    Page<Notification> findAllByOrderByCreatedAtDesc(Pageable p);

    @Modifying
    @Query("update Notification n set n.readFlag = true, n.readAt = :now where n.userId = :userId and n.channel = 'IN_APP' and n.readFlag = false")
    int markAllRead(Long userId, Instant now);

    @Query("select n.channel, n.status, count(n) from Notification n group by n.channel, n.status")
    List<Object[]> stats();
}
