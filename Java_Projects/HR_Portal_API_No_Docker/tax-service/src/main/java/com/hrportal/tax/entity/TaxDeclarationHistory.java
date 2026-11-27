package com.hrportal.tax.entity;

import java.math.BigDecimal;

import com.hrportal.common.persistence.BaseEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Declaration history: every step with the declared total at that moment (who = createdBy, when = createdAt). */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "tax_declaration_history", indexes = @Index(name = "idx_declaration_history", columnList = "declarationId,createdAt"))
public class TaxDeclarationHistory extends BaseEntity {
    @Column(nullable = false, length = 36)
    private String declarationId;
    @Column(nullable = false, length = 30)
    private String action;
    @Column(length = 12)
    private String status;
    @Column(precision = 14, scale = 2)
    private BigDecimal totalDeclared;
    @Column(length = 500)
    private String comment;
}
