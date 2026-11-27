package com.hrportal.leave.entity;

import java.math.BigDecimal;
import java.time.Instant;

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

/** Leave-balance transaction history: filled by the trigger trg_leave_balance_history on every balance change. */
@Getter
@NoArgsConstructor
@Entity
@Immutable
@Table(name = "leave_balance_history", indexes = @Index(name = "idx_balance_hist_emp", columnList = "employeeId,balanceYear,changedAt"))
public class LeaveBalanceHistory {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false, length = 36)
    private String employeeId;
    @Column(nullable = false, length = 36)
    private String leaveTypeId;
    @Column(nullable = false)
    private int balanceYear;
    @Column(precision = 6, scale = 2)
    private BigDecimal oldAccrued;
    @Column(precision = 6, scale = 2)
    private BigDecimal newAccrued;
    @Column(precision = 6, scale = 2)
    private BigDecimal oldUsed;
    @Column(precision = 6, scale = 2)
    private BigDecimal newUsed;
    @Column(precision = 6, scale = 2)
    private BigDecimal oldPending;
    @Column(precision = 6, scale = 2)
    private BigDecimal newPending;
    @Column(precision = 6, scale = 2)
    private BigDecimal oldCarried;
    @Column(precision = 6, scale = 2)
    private BigDecimal newCarried;
    @Column(precision = 6, scale = 2)
    private BigDecimal oldEncashed;
    @Column(precision = 6, scale = 2)
    private BigDecimal newEncashed;
    @Column(nullable = false)
    private Instant changedAt;
    @Column(length = 100)
    private String changedBy;
}
