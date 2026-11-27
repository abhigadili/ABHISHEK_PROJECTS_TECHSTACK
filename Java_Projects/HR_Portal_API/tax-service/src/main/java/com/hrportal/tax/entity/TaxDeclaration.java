package com.hrportal.tax.entity;

import java.math.BigDecimal;
import java.time.Instant;

import com.hrportal.common.persistence.BaseEntity;
import com.hrportal.tax.entity.Enums.DeclarationStatus;
import com.hrportal.tax.entity.Enums.Regime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import jakarta.persistence.Version;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** One declaration per employee per financial year; it moves through DRAFT -> SUBMITTED -> UNDER_REVIEW -> APPROVED / REJECTED (and back to editing after a rejection). */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "tax_declarations", uniqueConstraints = @UniqueConstraint(name = "uk_declaration_employee_fy", columnNames = {"employeeId", "financialYear"}),
        indexes = @Index(name = "idx_declaration_status", columnList = "status"))
public class TaxDeclaration extends BaseEntity {
    @Column(nullable = false, length = 36)
    private String employeeId;
    @Column(length = 200)
    private String employeeName;
    @Column(nullable = false, length = 7)
    private String financialYear;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 3)
    private Regime regime = Regime.NEW;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 12)
    private DeclarationStatus status = DeclarationStatus.DRAFT;
    @Column(nullable = false, precision = 14, scale = 2)
    private BigDecimal totalDeclared = BigDecimal.ZERO;
    @Column(nullable = false, precision = 14, scale = 2)
    private BigDecimal totalApproved = BigDecimal.ZERO;
    private Instant submittedAt;
    @Column(length = 36)
    private String reviewerId;
    @Column(length = 500)
    private String reviewComment;
    private Instant reviewedAt;
    @Version
    private long version;
}
