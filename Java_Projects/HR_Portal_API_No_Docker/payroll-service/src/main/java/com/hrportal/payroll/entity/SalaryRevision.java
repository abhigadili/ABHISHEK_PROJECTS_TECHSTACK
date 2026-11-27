package com.hrportal.payroll.entity;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

import com.hrportal.common.persistence.BaseEntity;
import com.hrportal.payroll.entity.Enums.RevisionStatus;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Salary revision request: created by payroll, approved by finance (maker-checker), then applied as a new EmployeeSalary. */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "salary_revisions", indexes = @Index(name = "idx_revision_status", columnList = "status,employeeId"))
public class SalaryRevision extends BaseEntity {
    @Column(nullable = false, length = 36)
    private String employeeId;
    @Column(nullable = false, precision = 14, scale = 2)
    private BigDecimal oldCtc;
    @Column(nullable = false, precision = 14, scale = 2)
    private BigDecimal newCtc;
    @Column(length = 36)
    private String newStructureId;
    @Column(nullable = false)
    private LocalDate effectiveFrom;
    @Column(nullable = false, length = 300)
    private String reason;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private RevisionStatus status = RevisionStatus.PENDING;
    @Column(length = 100)
    private String decidedBy;
    private Instant decidedAt;
    @Column(length = 300)
    private String decisionComment;
}
