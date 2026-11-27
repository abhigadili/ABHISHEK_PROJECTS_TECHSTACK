package com.hrportal.performance.entity;

import java.math.BigDecimal;

import com.hrportal.common.persistence.BaseEntity;
import com.hrportal.performance.entity.Enums.Respondent;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "review_answers", uniqueConstraints = @UniqueConstraint(name = "uk_answer", columnNames = {"reviewId", "questionId", "respondent"}),
        indexes = @Index(name = "idx_answer_review", columnList = "reviewId"))
public class ReviewAnswer extends BaseEntity {
    @Column(nullable = false, length = 36)
    private String reviewId;
    @Column(nullable = false, length = 36)
    private String questionId;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 8)
    private Respondent respondent;
    @Column(precision = 3, scale = 1)
    private BigDecimal rating;
    @Column(length = 2000)
    private String answerText;
}
