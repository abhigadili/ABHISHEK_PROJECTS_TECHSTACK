package com.hrportal.performance.entity;

import java.math.BigDecimal;
import java.time.Instant;

import com.hrportal.common.persistence.BaseEntity;
import com.hrportal.performance.entity.Enums.ReviewStatus;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import jakarta.persistence.Version;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** One review per employee per cycle (unique key). */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "performance_reviews", uniqueConstraints = @UniqueConstraint(name = "uk_review_cycle_employee", columnNames = {"cycleId", "employeeId"}),
        indexes = {@Index(name = "idx_review_manager", columnList = "managerId,status"), @Index(name = "idx_review_status", columnList = "status")})
public class PerformanceReview extends BaseEntity {
    @Column(nullable = false, length = 36)
    private String cycleId;
    @Column(nullable = false, length = 36)
    private String employeeId;
    @Column(length = 200)
    private String employeeName;
    @Column(length = 36)
    private String managerId;
    @Column(nullable = false, length = 36)
    private String formId;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ReviewStatus status = ReviewStatus.SELF_PENDING;
    @Column(precision = 3, scale = 1)
    private BigDecimal selfRating;
    @Column(precision = 3, scale = 1)
    private BigDecimal managerRating;
    @Column(precision = 3, scale = 1)
    private BigDecimal finalRating;
    @Column(length = 2000)
    private String achievements;
    @Column(length = 2000)
    private String strengths;
    @Column(length = 2000)
    private String improvementAreas;
    @Column(length = 2000)
    private String managerFeedback;
    @Column(length = 1000)
    private String hrComment;
    private Instant selfSubmittedAt;
    private Instant managerSubmittedAt;
    private Instant approvedAt;
    @Version
    private long version;
}
