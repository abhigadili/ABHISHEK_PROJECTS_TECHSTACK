package com.hrportal.payroll.entity;

import java.math.BigDecimal;

import com.hrportal.common.persistence.BaseEntity;
import com.hrportal.payroll.entity.Enums.ComponentType;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "payroll_entry_lines", indexes = {@Index(name = "idx_line_entry", columnList = "entryId"), @Index(name = "idx_line_component", columnList = "componentCode")})
public class PayrollEntryLine extends BaseEntity {
    @Column(nullable = false, length = 36)
    private String entryId;
    @Column(nullable = false, length = 40)
    private String componentCode;
    @Column(nullable = false, length = 100)
    private String componentName;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private ComponentType type;
    @Column(nullable = false, precision = 14, scale = 2)
    private BigDecimal amount;
    @Column(length = 200)
    private String note;
}
