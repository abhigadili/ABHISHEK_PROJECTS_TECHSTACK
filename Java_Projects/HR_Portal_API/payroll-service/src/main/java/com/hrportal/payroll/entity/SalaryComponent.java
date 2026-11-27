package com.hrportal.payroll.entity;

import org.hibernate.annotations.SQLRestriction;

import com.hrportal.common.persistence.SoftDeletableEntity;
import com.hrportal.payroll.entity.Enums.CalcType;
import com.hrportal.payroll.entity.Enums.ComponentType;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "salary_components", uniqueConstraints = @UniqueConstraint(name = "uk_component_code", columnNames = "code"))
@SQLRestriction("deleted = false")
public class SalaryComponent extends SoftDeletableEntity {
    @Column(nullable = false, length = 40)
    private String code;
    @Column(nullable = false, length = 100)
    private String name;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private ComponentType type;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private CalcType calcType = CalcType.FIXED;
    @Column(nullable = false)
    private boolean taxable = true;
    @Column(nullable = false)
    private int displayOrder = 100;
    @Column(nullable = false)
    private boolean active = true;
}
