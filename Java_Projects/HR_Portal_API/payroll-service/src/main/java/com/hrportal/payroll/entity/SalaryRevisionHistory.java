package com.hrportal.payroll.entity;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

import org.hibernate.annotations.Immutable;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;

/** Written ONLY by the triggers trg_salary_history_insert / trg_salary_history_update on employee_salaries. */
@Getter
@NoArgsConstructor
@Entity
@Immutable
@Table(name = "salary_revision_history", indexes = @Index(name = "idx_salary_hist_employee", columnList = "employeeId,changedAt"))
public class SalaryRevisionHistory {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false, length = 36)
    private String employeeId;
    @Column(nullable = false, length = 36)
    private String salaryId;
    @Column(nullable = false, length = 10)
    private String action;
    @Column(precision = 14, scale = 2)
    private BigDecimal oldCtc;
    @Column(precision = 14, scale = 2)
    private BigDecimal newCtc;
    @Column(length = 12)
    private String oldStatus;
    @Column(length = 12)
    private String newStatus;
    private LocalDate effectiveFrom;
    @Column(nullable = false)
    private Instant changedAt;
    @Column(length = 100)
    private String changedBy;
}
