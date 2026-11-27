package com.hrportal.tax.entity;

import java.math.BigDecimal;

import com.hrportal.common.persistence.BaseEntity;
import com.hrportal.tax.entity.Enums.InvestmentStatus;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** A tax-saving investment / expense under a deduction section (80C, 80D, HRA, home-loan interest ...). */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "investment_declarations", indexes = @Index(name = "idx_investment_declaration", columnList = "declarationId"))
public class InvestmentDeclaration extends BaseEntity {
    @Column(nullable = false, length = 36)
    private String declarationId;
    @Column(nullable = false, length = 20)
    private String section;
    @Column(nullable = false, length = 200)
    private String description;
    @Column(nullable = false, precision = 14, scale = 2)
    private BigDecimal declaredAmount;
    @Column(nullable = false, precision = 14, scale = 2)
    private BigDecimal approvedAmount = BigDecimal.ZERO;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private InvestmentStatus status = InvestmentStatus.DECLARED;
}
