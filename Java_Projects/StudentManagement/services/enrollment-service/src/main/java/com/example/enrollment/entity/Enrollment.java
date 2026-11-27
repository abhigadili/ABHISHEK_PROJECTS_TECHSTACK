package com.example.enrollment.entity;

import com.example.common.exception.BusinessRuleException;
import jakarta.persistence.*;
import java.time.LocalDateTime;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

@Entity
@Table(name = "sms_enrollments")
@Getter @Setter @NoArgsConstructor
public class Enrollment {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "enrollment_id")
    private Long enrollmentId;

    @Column(name = "student_id", nullable = false)
    private Long studentId;

    @Column(name = "course_id", nullable = false)
    private Long courseId;

    @Column(name = "student_name", length = 120)
    private String studentName;

    @Column(name = "student_email", length = 100)
    private String studentEmail;

    @Column(name = "course_name", length = 120)
    private String courseName;

    @Column(name = "enrollment_date", nullable = false)
    private LocalDateTime enrollmentDate = LocalDateTime.now();

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private EnrollmentStatus status;

    @Column(name = "idempotency_key", nullable = false, length = 64, updatable = false)
    private String idempotencyKey;

    @Column(length = 500)
    private String remarks;

    /** Database-generated (see V1 migration): non-null only for PENDING/CONFIRMED, UNIQUE -> blocks duplicate active enrollments. */
    @Column(name = "active_key", insertable = false, updatable = false)
    private String activeKey;

    @Version
    private long version;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    public void transitionTo(EnrollmentStatus next) {
        if (!status.allowedNext().contains(next)) {
            throw new BusinessRuleException("Enrollment " + enrollmentId + " cannot move from " + status + " to " + next);
        }
        this.status = next;
    }
}
