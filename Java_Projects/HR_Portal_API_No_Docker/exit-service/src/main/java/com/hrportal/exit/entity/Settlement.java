package com.hrportal.exit.entity;

import java.math.BigDecimal;
import java.time.Instant;

import com.hrportal.common.persistence.BaseEntity;
import com.hrportal.exit.entity.Enums.SettlementStatus;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Full and final settlement of a resignation; totals are computed from the lines by the stored procedure sp_exit_settlement_summary. */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "settlements", uniqueConstraints = @UniqueConstraint(name = "uk_settlement_resignation", columnNames = "resignationId"))
public class Settlement extends BaseEntity {
    @Column(nullable = false, length = 36)
    private String resignationId;
    @Column(nullable = false, length = 36)
    private String employeeId;
    @Column(nullable = false, precision = 14, scale = 2)
    private BigDecimal grossPayable = BigDecimal.ZERO;
    @Column(nullable = false, precision = 14, scale = 2)
    private BigDecimal recoveries = BigDecimal.ZERO;
    @Column(nullable = false, precision = 14, scale = 2)
    private BigDecimal netPayable = BigDecimal.ZERO;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 12)
    private SettlementStatus status = SettlementStatus.CALCULATED;
    @Column(length = 100)
    private String calculatedBy;
    @Column(length = 100)
    private String processedBy;
    @Column(length = 80)
    private String paymentReference;
    private Instant paidAt;
}
