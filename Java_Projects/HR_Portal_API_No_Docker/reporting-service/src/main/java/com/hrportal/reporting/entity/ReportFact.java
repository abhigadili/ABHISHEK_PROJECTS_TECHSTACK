package com.hrportal.reporting.entity;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

import com.hrportal.common.persistence.BaseEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * One row per business fact received through Kafka (a leave application, an attendance day, a payroll line, a tax declaration, a timesheet,
 * a review, a resignation, a project allocation). (factType, subjectKey) is unique, so replays and status changes are upserts.
 * Column meaning per fact type: see docs/202611251532-database-design.md (numA / numB / numC / dateA / dateB are type specific measures).
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "rpt_facts", uniqueConstraints = @UniqueConstraint(name = "uk_fact", columnNames = {"factType", "subjectKey"}),
        indexes = {@Index(name = "idx_fact_type_period", columnList = "factType,periodKey"), @Index(name = "idx_fact_employee", columnList = "employeeId,factType")})
public class ReportFact extends BaseEntity {
    @Column(nullable = false, length = 20)
    private String factType;
    @Column(nullable = false, length = 100)
    private String subjectKey;
    @Column(length = 36)
    private String employeeId;
    @Column(length = 36)
    private String departmentId;
    @Column(length = 40)
    private String periodKey;
    @Column(length = 80)
    private String category;
    @Column(length = 30)
    private String status;
    @Column(name = "num_a", precision = 16, scale = 2)
    private BigDecimal numA;
    @Column(name = "num_b", precision = 16, scale = 2)
    private BigDecimal numB;
    @Column(name = "num_c", precision = 16, scale = 2)
    private BigDecimal numC;
    @Column(name = "date_a")
    private LocalDate dateA;
    @Column(name = "date_b")
    private LocalDate dateB;
    @Column(nullable = false)
    private Instant occurredAt = Instant.now();
}
