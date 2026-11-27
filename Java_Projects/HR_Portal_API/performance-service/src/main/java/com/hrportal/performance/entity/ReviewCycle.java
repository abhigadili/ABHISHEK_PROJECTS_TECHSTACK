package com.hrportal.performance.entity;

import java.time.LocalDate;

import com.hrportal.common.persistence.BaseEntity;
import com.hrportal.performance.entity.Enums.CycleStatus;
import com.hrportal.performance.entity.Enums.CycleType;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Review cycle with its review period and stage deadlines. */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "review_cycles")
public class ReviewCycle extends BaseEntity {
    @Column(nullable = false, length = 120)
    private String name;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 12)
    private CycleType type = CycleType.ANNUAL;
    @Column(nullable = false)
    private LocalDate periodStart;
    @Column(nullable = false)
    private LocalDate periodEnd;
    @Column(nullable = false)
    private LocalDate selfEvalDeadline;
    @Column(nullable = false)
    private LocalDate managerEvalDeadline;
    @Column(nullable = false, length = 36)
    private String formId;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private CycleStatus status = CycleStatus.DRAFT;
}
