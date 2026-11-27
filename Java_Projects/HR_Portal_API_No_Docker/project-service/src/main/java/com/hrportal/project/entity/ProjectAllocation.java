package com.hrportal.project.entity;

import java.math.BigDecimal;
import java.time.LocalDate;

import com.hrportal.common.persistence.BaseEntity;
import com.hrportal.project.entity.Enums.AllocationStatus;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** An employee's allocation (percentage of their time) to a project for a period. */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "project_allocations", indexes = {@Index(name = "idx_alloc_project", columnList = "projectId,status"),
        @Index(name = "idx_alloc_employee", columnList = "employeeId,startDate,endDate")})
public class ProjectAllocation extends BaseEntity {
    @Column(nullable = false, length = 36)
    private String projectId;
    @Column(nullable = false, length = 36)
    private String employeeId;
    @Column(length = 200)
    private String employeeName;
    @Column(nullable = false, length = 80)
    private String role;
    @Column(nullable = false, precision = 5, scale = 2)
    private BigDecimal allocationPercent;
    @Column(nullable = false)
    private LocalDate startDate;
    private LocalDate endDate;
    @Column(nullable = false)
    private boolean billable = true;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private AllocationStatus status = AllocationStatus.ACTIVE;
}
