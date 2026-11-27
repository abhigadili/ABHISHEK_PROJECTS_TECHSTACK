package com.hrportal.payroll.entity;

import java.math.BigDecimal;
import java.time.Instant;

import com.hrportal.common.persistence.BaseEntity;
import com.hrportal.payroll.entity.Enums.RunStatus;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import jakarta.persistence.Version;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** One payroll run per month (unique): DRAFT -> PROCESSED -> APPROVED -> FINALIZED. */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "payroll_runs", uniqueConstraints = @UniqueConstraint(name = "uk_payroll_run_month", columnNames = "payrollMonth"))
public class PayrollRun extends BaseEntity {
    /** yyyy-MM */
    @Column(nullable = false, length = 7)
    private String payrollMonth;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private RunStatus status = RunStatus.DRAFT;
    @Column(nullable = false)
    private int employeeCount;
    @Column(nullable = false, precision = 16, scale = 2)
    private BigDecimal totalGross = BigDecimal.ZERO;
    @Column(nullable = false, precision = 16, scale = 2)
    private BigDecimal totalDeductions = BigDecimal.ZERO;
    @Column(nullable = false, precision = 16, scale = 2)
    private BigDecimal totalNet = BigDecimal.ZERO;
    private Instant processedAt;
    @Column(length = 100)
    private String processedBy;
    private Instant approvedAt;
    @Column(length = 100)
    private String approvedBy;
    private Instant finalizedAt;
    @Column(length = 100)
    private String finalizedBy;
    @Column(length = 300)
    private String note;
    @Version
    private long version;
}
