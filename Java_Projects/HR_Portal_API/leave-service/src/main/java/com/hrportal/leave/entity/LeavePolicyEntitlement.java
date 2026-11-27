package com.hrportal.leave.entity;

import java.math.BigDecimal;
import java.time.Instant;

import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EntityListeners;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Composite primary key through {@link IdClass}: one row per (policy, leave type).
 * Carries the accrual rule, the carry-forward cap and the encashment configuration.
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "leave_policy_entitlements")
@IdClass(PolicyEntitlementId.class)
@EntityListeners(AuditingEntityListener.class)
public class LeavePolicyEntitlement {
    @Id
    @Column(length = 36)
    private String policyId;
    @Id
    @Column(length = 36)
    private String leaveTypeId;
    @Column(nullable = false, precision = 5, scale = 1)
    private BigDecimal annualDays = BigDecimal.ZERO;
    /** 0 = granted in full upfront; > 0 = accrued every month (capped at annualDays). */
    @Column(nullable = false, precision = 4, scale = 2)
    private BigDecimal accrualPerMonth = BigDecimal.ZERO;
    @Column(nullable = false, precision = 5, scale = 1)
    private BigDecimal carryForwardMax = BigDecimal.ZERO;
    @Column(nullable = false)
    private boolean encashable;
    @Column(nullable = false, precision = 5, scale = 1)
    private BigDecimal encashmentMaxDays = BigDecimal.ZERO;
    @CreatedDate
    @Column(updatable = false)
    private Instant createdAt;
    @LastModifiedDate
    private Instant updatedAt;
}
