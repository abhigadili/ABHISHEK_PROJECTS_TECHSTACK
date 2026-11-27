package com.hrportal.tax.entity;

import java.math.BigDecimal;

import com.hrportal.common.persistence.BaseEntity;
import com.hrportal.tax.entity.Enums.Regime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Configurable tax rules per financial year and regime: slabs, standard deduction, rebate, cess and the cap of every deduction section.
 * Nothing is hard-coded: the shipped rows are SAMPLES and must be verified against the current Finance Act before real use.
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "tax_rules", uniqueConstraints = @UniqueConstraint(name = "uk_tax_rule_fy_regime", columnNames = {"financialYear", "regime"}))
public class TaxRule extends BaseEntity {
    /** e.g. 2026-27 (April 2026 - March 2027) */
    @Column(nullable = false, length = 7)
    private String financialYear;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 3)
    private Regime regime;
    /** JSON array: [{"from":0,"to":400000,"rate":0}, ... , {"from":2400000,"to":null,"rate":30}] */
    @Column(nullable = false, columnDefinition = "json")
    private String slabs;
    /** JSON object: section -> annual cap, e.g. {"80C":150000}. Empty for a regime without deductions. */
    @Column(nullable = false, columnDefinition = "json")
    private String sectionLimits = "{}";
    @Column(nullable = false, precision = 14, scale = 2)
    private BigDecimal standardDeduction = BigDecimal.ZERO;
    @Column(nullable = false, precision = 5, scale = 2)
    private BigDecimal cessPercent = new BigDecimal("4.00");
    @Column(nullable = false, precision = 14, scale = 2)
    private BigDecimal rebateLimit = BigDecimal.ZERO;
    @Column(nullable = false, precision = 14, scale = 2)
    private BigDecimal rebateAmount = BigDecimal.ZERO;
    @Column(nullable = false)
    private boolean active = true;
}
