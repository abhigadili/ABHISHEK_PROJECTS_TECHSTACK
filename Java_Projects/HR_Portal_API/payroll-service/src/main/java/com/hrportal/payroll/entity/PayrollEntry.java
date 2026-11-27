package com.hrportal.payroll.entity;

import java.math.BigDecimal;

import com.hrportal.common.persistence.BaseEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** One employee's result in a run (totals are re-aggregated from the lines by the stored procedure). */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "payroll_entries", uniqueConstraints = @UniqueConstraint(name = "uk_entry_run_employee", columnNames = {"runId", "employeeId"}),
        indexes = {@Index(name = "idx_entry_employee", columnList = "employeeId"), @Index(name = "idx_entry_run", columnList = "runId")})
public class PayrollEntry extends BaseEntity {
    @Column(nullable = false, length = 36)
    private String runId;
    @Column(nullable = false, length = 7)
    private String payrollMonth;
    @Column(nullable = false, length = 36)
    private String employeeId;
    @Column(length = 200)
    private String employeeName;
    @Column(length = 30)
    private String employeeCode;
    @Column(length = 36)
    private String departmentId;
    @Column(nullable = false, length = 36)
    private String salaryId;
    @Column(nullable = false, precision = 5, scale = 1)
    private BigDecimal workingDays = BigDecimal.ZERO;
    @Column(nullable = false, precision = 5, scale = 1)
    private BigDecimal paidDays = BigDecimal.ZERO;
    @Column(nullable = false, precision = 5, scale = 1)
    private BigDecimal lopDays = BigDecimal.ZERO;
    @Column(nullable = false)
    private int overtimeMinutes;
    @Column(nullable = false, precision = 14, scale = 2)
    private BigDecimal gross = BigDecimal.ZERO;
    @Column(nullable = false, precision = 14, scale = 2)
    private BigDecimal deductions = BigDecimal.ZERO;
    @Column(nullable = false, precision = 14, scale = 2)
    private BigDecimal net = BigDecimal.ZERO;
}
