package com.hospital.notification.domain;

import java.time.Instant;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "notifications", indexes = {
        @Index(name = "idx_notification_recipient", columnList = "recipientEmail,createdAt"),
        @Index(name = "idx_notification_event", columnList = "eventType,referenceId")})
public class Notification {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false, length = 120)
    private String recipientEmail;
    @Column(length = 20)
    private String recipientPhone;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 6)
    private Channel channel = Channel.EMAIL;
    @Column(nullable = false, length = 200)
    private String subject;
    @Column(nullable = false, length = 2000)
    private String message;
    @Column(nullable = false, length = 40)
    private String eventType;
    @Column(length = 40)
    private String referenceId;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 8)
    private Status status = Status.SENT;
    @Column(length = 255)
    private String failureReason;
    @Column(nullable = false, updatable = false)
    private Instant createdAt = Instant.now();
    private Instant sentAt;

    public enum Channel { EMAIL, SMS }

    public enum Status { SENT, FAILED }
}
