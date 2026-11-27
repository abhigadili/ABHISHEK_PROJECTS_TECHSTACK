package com.hrportal.attendance.entity;

import java.time.Instant;
import java.time.LocalDate;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Local employee facts (manager, location, status) kept current by employee.* events. */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "attendance_employees")
public class AttendanceEmployee {
    @Id
    @Column(length = 36)
    private String employeeId;
    @Column(length = 200)
    private String fullName;
    @Column(length = 36)
    private String managerId;
    @Column(length = 36)
    private String departmentId;
    @Column(length = 36)
    private String locationId;
    private LocalDate joiningDate;
    @Column(nullable = false, length = 15)
    private String status = "ACTIVE";
    @Column(nullable = false)
    private Instant updatedAt = Instant.now();
}
