package com.hrportal.leave.entity;

import java.math.BigDecimal;
import java.time.Instant;

import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedBy;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import jakarta.persistence.Column;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.EntityListeners;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Yearly balance per employee and leave type. Optimistic locking ({@code @Version}) catches lost updates; the apply
 * workflow additionally takes a PESSIMISTIC_WRITE lock so two simultaneous applications cannot both pass the check.
 * Every UPDATE is mirrored into leave_balance_history by a MySQL trigger.
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "leave_balances")
@EntityListeners(AuditingEntityListener.class)
public class LeaveBalance {
    @EmbeddedId
    private LeaveBalanceId id;
    @Column(nullable = false, precision = 6, scale = 2)
    private BigDecimal opening = BigDecimal.ZERO;
    @Column(nullable = false, precision = 6, scale = 2)
    private BigDecimal accrued = BigDecimal.ZERO;
    @Column(nullable = false, precision = 6, scale = 2)
    private BigDecimal carriedForward = BigDecimal.ZERO;
    @Column(nullable = false, precision = 6, scale = 2)
    private BigDecimal adjusted = BigDecimal.ZERO;
    @Column(nullable = false, precision = 6, scale = 2)
    private BigDecimal used = BigDecimal.ZERO;
    /** Days reserved by applications that are still waiting for approval. */
    @Column(nullable = false, precision = 6, scale = 2)
    private BigDecimal pending = BigDecimal.ZERO;
    @Column(nullable = false, precision = 6, scale = 2)
    private BigDecimal encashed = BigDecimal.ZERO;
    @Version
    private long version;
    @CreatedDate
    @Column(updatable = false)
    private Instant createdAt;
    @LastModifiedDate
    private Instant updatedAt;
    @LastModifiedBy
    @Column(length = 100)
    private String updatedBy;

    public LeaveBalance(LeaveBalanceId id) {
        this.id = id;
    }

    public BigDecimal available() {
        return opening.add(accrued).add(carriedForward).add(adjusted).subtract(used).subtract(pending).subtract(encashed);
    }
}
