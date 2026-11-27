package com.hrportal.leave.entity;

import java.time.Instant;
import java.time.LocalDate;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Local copy of the few employee facts the leave service needs for accrual runs, kept current by employee.* events. */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "leave_employees")
public class LeaveEmployee {
    @Id
    @Column(length = 36)
    private String employeeId;
    @Column(length = 200)
    private String fullName;
    private LocalDate joiningDate;
    @Column(length = 15)
    private String gender;
    @Column(length = 36)
    private String managerId;
    @Column(length = 36)
    private String departmentId;
    @Column(length = 36)
    private String locationId;
    @Column(nullable = false, length = 15)
    private String status = "ACTIVE";
    @Column(nullable = false)
    private Instant updatedAt = Instant.now();
}
