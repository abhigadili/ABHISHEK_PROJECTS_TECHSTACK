package com.hrportal.organization.entity;

import java.math.BigDecimal;

import com.hrportal.common.persistence.SoftDeletableEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.SQLRestriction;

@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "job_grades", uniqueConstraints = @UniqueConstraint(name = "uk_grade_code", columnNames = "code"))
@SQLRestriction("deleted = false")
public class JobGrade extends SoftDeletableEntity {
    @Column(nullable = false, length = 20)
    private String code;
    @Column(nullable = false, length = 100)
    private String name;
    @Column(name = "grade_level", nullable = false)
    private int level;
    @Column(precision = 14, scale = 2)
    private BigDecimal minSalary;
    @Column(precision = 14, scale = 2)
    private BigDecimal maxSalary;
    @Column(length = 3)
    private String currency = "INR";
}
