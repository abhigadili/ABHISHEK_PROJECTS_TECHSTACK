package com.hrportal.employee.entity;

import java.time.Instant;

import org.hibernate.annotations.Immutable;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;

/** Written ONLY by the MySQL trigger trg_employee_status_history (see V3 migration); the application just reads it. */
@Getter
@NoArgsConstructor
@Entity
@Immutable
@Table(name = "employee_status_history", indexes = @Index(name = "idx_status_history_employee", columnList = "employeeId,changedAt"))
public class EmployeeStatusHistory {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false, length = 36)
    private String employeeId;
    @Column(length = 15)
    private String oldStatus;
    @Column(nullable = false, length = 15)
    private String newStatus;
    @Column(nullable = false)
    private Instant changedAt;
    @Column(length = 100)
    private String changedBy;
}
