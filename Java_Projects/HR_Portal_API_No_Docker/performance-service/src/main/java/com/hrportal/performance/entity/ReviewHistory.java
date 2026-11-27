package com.hrportal.performance.entity;

import com.hrportal.common.persistence.BaseEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Review history: every stage change (who = createdBy, when = createdAt). */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "review_history", indexes = @Index(name = "idx_review_history", columnList = "reviewId,createdAt"))
public class ReviewHistory extends BaseEntity {
    @Column(nullable = false, length = 36)
    private String reviewId;
    @Column(nullable = false, length = 30)
    private String action;
    @Column(length = 20)
    private String status;
    @Column(length = 1000)
    private String comment;
}
