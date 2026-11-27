package com.hrportal.payroll.entity;

import java.math.BigDecimal;

import com.hrportal.common.persistence.BaseEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** A component inside a structure with its value: a percentage (of CTC / basic) or a fixed monthly amount, depending on the component's calc type. */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "salary_structure_components", uniqueConstraints = @UniqueConstraint(name = "uk_structure_component", columnNames = {"structureId", "componentId"}),
        indexes = @Index(name = "idx_ssc_structure", columnList = "structureId"))
public class SalaryStructureComponent extends BaseEntity {
    @Column(nullable = false, length = 36)
    private String structureId;
    @Column(nullable = false, length = 36)
    private String componentId;
    @Column(nullable = false, precision = 14, scale = 3)
    private BigDecimal value = BigDecimal.ZERO;
}
