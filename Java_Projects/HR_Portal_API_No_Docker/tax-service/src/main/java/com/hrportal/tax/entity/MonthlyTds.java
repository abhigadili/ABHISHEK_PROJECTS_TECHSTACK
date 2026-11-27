package com.hrportal.tax.entity;

import java.math.BigDecimal;
import java.time.Instant;

import com.hrportal.common.persistence.BaseEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Monthly TDS told to payroll (upserted per employee and month): the basis for the "tax already deducted" part of later months. */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "monthly_tds", uniqueConstraints = @UniqueConstraint(name = "uk_tds_employee_month", columnNames = {"employeeId", "tdsMonth"}),
        indexes = @Index(name = "idx_tds_fy", columnList = "employeeId,financialYear"))
public class MonthlyTds extends BaseEntity {
    @Column(nullable = false, length = 36)
    private String employeeId;
    @Column(nullable = false, length = 7)
    private String tdsMonth;
    @Column(nullable = false, length = 7)
    private String financialYear;
    @Column(nullable = false, precision = 14, scale = 2)
    private BigDecimal tds;
    @Column(nullable = false, length = 3)
    private String regime;
    @Column(nullable = false)
    private boolean declarationApproved;
    @Column(nullable = false)
    private Instant computedAt = Instant.now();
}
