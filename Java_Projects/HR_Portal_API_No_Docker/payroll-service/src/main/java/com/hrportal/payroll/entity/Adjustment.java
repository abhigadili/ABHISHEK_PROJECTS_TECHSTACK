package com.hrportal.payroll.entity;

import java.math.BigDecimal;

import com.hrportal.common.persistence.BaseEntity;
import com.hrportal.payroll.entity.Enums.AdjustmentStatus;
import com.hrportal.payroll.entity.Enums.AdjustmentType;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** One-off earnings / deductions for a month: bonus, arrears, reimbursement, allowance, other deduction, final settlement. */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "payroll_adjustments", indexes = @Index(name = "idx_adjustment_employee_month", columnList = "employeeId,payrollMonth,status"))
public class Adjustment extends BaseEntity {
    @Column(nullable = false, length = 36)
    private String employeeId;
    @Column(nullable = false, length = 7)
    private String payrollMonth;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private AdjustmentType type;
    @Column(nullable = false, precision = 14, scale = 2)
    private BigDecimal amount;
    @Column(length = 300)
    private String description;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private AdjustmentStatus status = AdjustmentStatus.PENDING;
    @Column(length = 36)
    private String appliedRunId;
    @Column(length = 36)
    private String referenceId;
}
