package com.hrportal.notification.entity;

import java.time.Instant;

import com.hrportal.common.persistence.BaseEntity;
import com.hrportal.notification.entity.Enums.Channel;
import com.hrportal.notification.entity.Enums.DeliveryStatus;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** One delivered (or to-be-delivered) notification: in-app inbox item or e-mail. Sensitive tokens are never stored in the body. */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "notifications", indexes = {@Index(name = "idx_notification_recipient", columnList = "recipientEmployeeId,channel,readAt,createdAt"),
        @Index(name = "idx_notification_status", columnList = "status,createdAt")})
public class Notification extends BaseEntity {
    @Column(length = 36)
    private String recipientEmployeeId;
    @Column(length = 150)
    private String recipientEmail;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private Channel channel;
    @Column(nullable = false, length = 60)
    private String type;
    @Column(nullable = false, length = 200)
    private String subject;
    @Column(nullable = false, length = 2000)
    private String body;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private DeliveryStatus status = DeliveryStatus.PENDING;
    private Instant readAt;
    private Instant sentAt;
    @Column(length = 40)
    private String referenceType;
    @Column(length = 64)
    private String referenceId;
    @Column(length = 64)
    private String correlationId;
    @Column(length = 200)
    private String errorMessage;
}
