package com.hrportal.tax.entity;

import java.math.BigDecimal;
import java.time.Instant;

import com.hrportal.common.persistence.BaseEntity;
import com.hrportal.tax.entity.Enums.Regime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Latest annual tax computation of an employee for a financial year (upserted every time it is recomputed). */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "tax_computations", uniqueConstraints = @UniqueConstraint(name = "uk_computation_employee_fy", columnNames = {"employeeId", "financialYear"}))
public class TaxComputation extends BaseEntity {
    @Column(nullable = false, length = 36)
    private String employeeId;
    @Column(nullable = false, length = 7)
    private String financialYear;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 3)
    private Regime regime;
    @Column(nullable = false, precision = 14, scale = 2)
    private BigDecimal grossIncome;
    @Column(nullable = false, precision = 14, scale = 2)
    private BigDecimal standardDeduction;
    @Column(nullable = false, precision = 14, scale = 2)
    private BigDecimal totalDeductions;
    @Column(nullable = false, precision = 14, scale = 2)
    private BigDecimal taxableIncome;
    @Column(nullable = false, precision = 14, scale = 2)
    private BigDecimal slabTax;
    @Column(nullable = false, precision = 14, scale = 2)
    private BigDecimal rebate;
    @Column(nullable = false, precision = 14, scale = 2)
    private BigDecimal cess;
    @Column(nullable = false, precision = 14, scale = 2)
    private BigDecimal totalTax;
    @Column(nullable = false)
    private boolean declarationApproved;
    @Column(nullable = false)
    private Instant computedAt = Instant.now();
}
