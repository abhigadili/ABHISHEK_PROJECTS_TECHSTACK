package com.hrportal.payroll.entity;

import java.math.BigDecimal;

import com.hrportal.common.persistence.BaseEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** EMI recovered in a run: written during processing; the stored procedure applies them to the loan balances. */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "loan_deductions", indexes = {@Index(name = "idx_loan_ded_run", columnList = "runId"), @Index(name = "idx_loan_ded_loan", columnList = "loanId")})
public class LoanDeduction extends BaseEntity {
    @Column(nullable = false, length = 36)
    private String loanId;
    @Column(nullable = false, length = 36)
    private String runId;
    @Column(nullable = false, length = 36)
    private String employeeId;
    @Column(nullable = false, precision = 14, scale = 2)
    private BigDecimal amount;
}
