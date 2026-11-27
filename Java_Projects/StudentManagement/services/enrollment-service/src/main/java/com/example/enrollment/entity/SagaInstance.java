package com.example.enrollment.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Persistent saga state: the orchestrator writes it after every step, so a crashed instance can be resumed. */
@Entity
@Table(name = "sms_saga_instances")
@Getter @Setter @NoArgsConstructor
public class SagaInstance {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "saga_id")
    private Long sagaId;

    @Column(name = "idempotency_key", nullable = false, length = 64, updatable = false)
    private String idempotencyKey;

    @Column(name = "student_id", nullable = false, updatable = false)
    private Long studentId;

    @Column(name = "course_id", nullable = false, updatable = false)
    private Long courseId;

    @Column(name = "enrollment_id")
    private Long enrollmentId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private SagaState state = SagaState.STARTED;

    @Column(name = "seat_reserved", nullable = false)
    private boolean seatReserved;

    @Column(name = "failure_reason", length = 500)
    private String failureReason;

    @Column(name = "student_name", length = 120)
    private String studentName;

    @Column(name = "student_email", length = 100)
    private String studentEmail;

    @Column(name = "course_name", length = 120)
    private String courseName;

    @Column(name = "correlation_id", length = 64)
    private String correlationId;

    @Column(nullable = false)
    private int attempts;

    @Version
    private long version;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt = LocalDateTime.now();

    @PreUpdate
    void touch() { this.updatedAt = LocalDateTime.now(); }
}
