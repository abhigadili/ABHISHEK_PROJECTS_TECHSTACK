package com.hrportal.employee.entity;

import com.hrportal.common.persistence.BaseEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Many-to-One side owns the foreign key; the read-only employeeId column avoids loading the Employee just to expose its id. */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "employee_education")
public class EmployeeEducation extends BaseEntity {
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "employee_id", nullable = false)
    private Employee employee;
    @Column(name = "employee_id", insertable = false, updatable = false, length = 36)
    private String employeeId;
    @Column(nullable = false, length = 120)
    private String degree;
    @Column(nullable = false, length = 200)
    private String institution;
    @Column(length = 120)
    private String fieldOfStudy;
    private Integer startYear;
    private Integer endYear;
    @Column(length = 40)
    private String grade;
}
