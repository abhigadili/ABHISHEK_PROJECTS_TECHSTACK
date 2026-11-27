package com.hrportal.employee.entity;

import java.time.LocalDate;

import com.hrportal.common.persistence.BaseEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Prior work experience (before joining). */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "employee_experience", indexes = @Index(name = "idx_experience_employee", columnList = "employeeId"))
public class EmployeeExperience extends BaseEntity {
    @Column(nullable = false, length = 36)
    private String employeeId;
    @Column(nullable = false, length = 150)
    private String company;
    @Column(nullable = false, length = 120)
    private String jobTitle;
    @Column(nullable = false)
    private LocalDate startDate;
    private LocalDate endDate;
    @Column(length = 500)
    private String description;
    @Column(nullable = false)
    private boolean verified;
}
