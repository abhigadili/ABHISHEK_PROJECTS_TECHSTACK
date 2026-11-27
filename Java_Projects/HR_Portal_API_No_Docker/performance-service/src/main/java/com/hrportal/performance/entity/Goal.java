package com.hrportal.performance.entity;

import java.time.LocalDate;

import org.hibernate.annotations.SQLRestriction;

import com.hrportal.common.persistence.SoftDeletableEntity;
import com.hrportal.performance.entity.Enums.GoalStatus;
import com.hrportal.performance.entity.Enums.GoalType;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Goal or OKR objective of an employee (optionally tied to a review cycle). */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "goals", indexes = @Index(name = "idx_goal_employee", columnList = "employeeId,cycleId"))
@SQLRestriction("deleted = false")
public class Goal extends SoftDeletableEntity {
    @Column(nullable = false, length = 36)
    private String employeeId;
    @Column(length = 36)
    private String cycleId;
    @Column(nullable = false, length = 200)
    private String title;
    @Column(length = 1000)
    private String description;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 6)
    private GoalType type = GoalType.GOAL;
    private LocalDate targetDate;
    @Column(nullable = false)
    private int progress;
    @Column(nullable = false)
    private int weight = 1;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 12)
    private GoalStatus status = GoalStatus.NOT_STARTED;
}
