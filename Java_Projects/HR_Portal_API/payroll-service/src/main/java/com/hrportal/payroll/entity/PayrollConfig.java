package com.hrportal.payroll.entity;

import java.time.Instant;

import com.hrportal.common.persistence.BaseEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Payroll / statutory configuration kept in the database (never in code): PF percentage and wage ceiling, professional-tax slabs,
 * overtime multiplier ... The shipped values are SAMPLES - statutory rates must be verified against current law before real payroll use.
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "payroll_config", uniqueConstraints = @UniqueConstraint(name = "uk_payroll_config_key", columnNames = "configKey"))
public class PayrollConfig extends BaseEntity {
    @Column(nullable = false, length = 80)
    private String configKey;
    @Column(nullable = false, length = 2000)
    private String configValue;
    @Column(length = 300)
    private String description;
    @Column(nullable = false)
    private Instant effectiveFrom = Instant.now();
}
