package com.hrportal.organization.entity;

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

/**
 * Read model of the reporting hierarchy, maintained ONLY from employee.* Kafka events (the Employee service stays the
 * source of truth - this service never reads its database). The primary key IS the employee id.
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "org_employee_nodes", indexes = {
        @Index(name = "idx_node_manager", columnList = "managerId"),
        @Index(name = "idx_node_department", columnList = "departmentId")})
public class OrgEmployeeNode {
    @Id
    @Column(length = 36)
    private String employeeId;
    @Column(length = 30)
    private String employeeCode;
    @Column(nullable = false, length = 200)
    private String fullName;
    @Column(length = 150)
    private String email;
    @Column(length = 36)
    private String departmentId;
    @Column(length = 36)
    private String designationId;
    @Column(length = 36)
    private String locationId;
    @Column(length = 36)
    private String managerId;
    @Column(nullable = false, length = 20)
    private String status;
    private LocalDate joiningDate;
    @Column(nullable = false)
    private Instant updatedAt = Instant.now();
}
