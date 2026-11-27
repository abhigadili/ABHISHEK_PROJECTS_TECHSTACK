package com.hrportal.performance.entity;

import java.math.BigDecimal;

import com.hrportal.common.persistence.BaseEntity;
import com.hrportal.performance.entity.Enums.FeedbackType;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Manager or peer feedback about an employee. Peer feedback hides the author from the receiver. */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "feedback", indexes = @Index(name = "idx_feedback_to", columnList = "toEmployeeId,createdAt"))
public class Feedback extends BaseEntity {
    @Column(nullable = false, length = 36)
    private String toEmployeeId;
    @Column(nullable = false, length = 36)
    private String fromEmployeeId;
    @Column(length = 36)
    private String reviewId;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 8)
    private FeedbackType type;
    @Column(nullable = false, length = 2000)
    private String comment;
    @Column(precision = 3, scale = 1)
    private BigDecimal rating;
}
