package com.fooddelivery.notification.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(name = "notifications", indexes = {@Index(name = "idx_notif_user_read_created", columnList = "userId,readFlag,createdAt"),
        @Index(name = "idx_notif_reference", columnList = "referenceType,referenceId")})
@Getter @Setter @NoArgsConstructor
public class Notification {
    public enum Channel { IN_APP, EMAIL, SMS }
    public enum Status { PENDING, SENT, FAILED }

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false) private Long userId;
    @Column(nullable = false, length = 150) private String title;
    @Column(nullable = false, length = 1000) private String message;
    @Column(nullable = false, length = 40) private String type;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 8) private Channel channel;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 8) private Status status = Status.PENDING;
    @Column(nullable = false) private boolean readFlag;
    @Column(length = 20) private String referenceType;
    private Long referenceId;
    @Column(length = 64) private String correlationId;
    @Column(length = 60) private String providerRef;
    @Column(length = 300) private String error;
    @Column(nullable = false) private Instant createdAt = Instant.now();
    private Instant sentAt;
    private Instant readAt;
}
