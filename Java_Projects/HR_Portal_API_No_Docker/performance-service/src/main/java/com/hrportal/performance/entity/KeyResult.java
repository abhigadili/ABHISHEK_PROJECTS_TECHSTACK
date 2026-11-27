package com.hrportal.performance.entity;

import java.math.BigDecimal;

import com.hrportal.common.persistence.BaseEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Measurable key result of an OKR objective: progress = current / target. */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "key_results", indexes = @Index(name = "idx_kr_goal", columnList = "goalId"))
public class KeyResult extends BaseEntity {
    @Column(nullable = false, length = 36)
    private String goalId;
    @Column(nullable = false, length = 300)
    private String description;
    @Column(nullable = false, precision = 14, scale = 2)
    private BigDecimal targetValue;
    @Column(nullable = false, precision = 14, scale = 2)
    private BigDecimal currentValue = BigDecimal.ZERO;
    @Column(length = 30)
    private String unit;
}
