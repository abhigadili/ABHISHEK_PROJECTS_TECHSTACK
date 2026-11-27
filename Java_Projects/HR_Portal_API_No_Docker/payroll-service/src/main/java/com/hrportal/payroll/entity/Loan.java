package com.hrportal.payroll.entity;

import java.math.BigDecimal;

import com.hrportal.common.persistence.BaseEntity;
import com.hrportal.payroll.entity.Enums.LoanStatus;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Employee loan / advance recovered in monthly instalments (EMI) through payroll. */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "loans", indexes = @Index(name = "idx_loan_employee", columnList = "employeeId,status"))
public class Loan extends BaseEntity {
    @Column(nullable = false, length = 36)
    private String employeeId;
    @Column(nullable = false, length = 120)
    private String description;
    @Column(nullable = false, precision = 14, scale = 2)
    private BigDecimal principal;
    @Column(nullable = false, precision = 14, scale = 2)
    private BigDecimal emi;
    @Column(nullable = false, precision = 14, scale = 2)
    private BigDecimal outstanding;
    /** First month in which the EMI is deducted (yyyy-MM). */
    @Column(nullable = false, length = 7)
    private String startMonth;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private LoanStatus status = LoanStatus.ACTIVE;
    @Version
    private long version;
}
