package com.hrportal.payroll.entity;

import org.hibernate.annotations.SQLRestriction;

import com.hrportal.common.persistence.SoftDeletableEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "salary_structures")
@SQLRestriction("deleted = false")
public class SalaryStructure extends SoftDeletableEntity {
    @Column(nullable = false, length = 100)
    private String name;
    @Column(length = 300)
    private String description;
    @Column(nullable = false)
    private boolean active = true;
}
