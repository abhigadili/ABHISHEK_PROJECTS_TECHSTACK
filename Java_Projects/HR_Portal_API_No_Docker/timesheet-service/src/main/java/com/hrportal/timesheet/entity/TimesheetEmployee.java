package com.hrportal.timesheet.entity;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Local employee facts (name, manager, status) kept current by employee.* events. */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "timesheet_employees")
public class TimesheetEmployee {
    @Id
    @Column(length = 36)
    private String employeeId;
    @Column(length = 200)
    private String fullName;
    @Column(length = 36)
    private String managerId;
    @Column(nullable = false, length = 15)
    private String status = "ACTIVE";
    @Column(nullable = false)
    private Instant updatedAt = Instant.now();
}
