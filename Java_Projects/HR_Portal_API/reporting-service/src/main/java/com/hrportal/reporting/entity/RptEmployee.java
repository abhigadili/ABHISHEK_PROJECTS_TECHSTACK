package com.hrportal.reporting.entity;

import java.time.Instant;
import java.time.LocalDate;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Reporting copy of the employee master (maintained ONLY from employee.* events - reporting never reads the Employee database). */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "rpt_employees", indexes = {@Index(name = "idx_rpt_emp_dept", columnList = "departmentId,status"), @Index(name = "idx_rpt_emp_joining", columnList = "joiningDate")})
public class RptEmployee {
    @Id
    @Column(length = 36)
    private String employeeId;
    @Column(length = 30)
    private String employeeCode;
    @Column(length = 200)
    private String fullName;
    @Column(length = 36)
    private String departmentId;
    @Column(length = 36)
    private String designationId;
    @Column(length = 36)
    private String locationId;
    @Column(length = 36)
    private String managerId;
    @Column(nullable = false, length = 15)
    private String status = "ACTIVE";
    private LocalDate joiningDate;
    private LocalDate exitDate;
    @Column(nullable = false)
    private Instant updatedAt = Instant.now();
}
