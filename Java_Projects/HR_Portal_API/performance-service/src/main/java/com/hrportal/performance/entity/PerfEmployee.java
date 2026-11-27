package com.hrportal.performance.entity;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Local employee list (name, manager, department, status) maintained from employee.* events; the review population of a cycle. */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "perf_employees")
public class PerfEmployee {
    @Id
    @Column(length = 36)
    private String employeeId;
    @Column(length = 200)
    private String fullName;
    @Column(length = 36)
    private String managerId;
    @Column(length = 36)
    private String departmentId;
    @Column(nullable = false, length = 15)
    private String status = "ACTIVE";
    @Column(nullable = false)
    private Instant updatedAt = Instant.now();
}
