package com.hrportal.timesheet.entity;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

import com.hrportal.common.persistence.BaseEntity;
import com.hrportal.timesheet.entity.Enums.TimesheetStatus;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import jakarta.persistence.Version;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** One timesheet per employee per week (Monday start) - the unique key makes duplicate weekly sheets impossible. */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "timesheets", uniqueConstraints = @UniqueConstraint(name = "uk_timesheet_employee_week", columnNames = {"employeeId", "weekStart"}),
        indexes = {@Index(name = "idx_timesheet_status", columnList = "status,approverId"), @Index(name = "idx_timesheet_week", columnList = "weekStart")})
public class Timesheet extends BaseEntity {
    @Column(nullable = false, length = 36)
    private String employeeId;
    @Column(length = 200)
    private String employeeName;
    @Column(nullable = false)
    private LocalDate weekStart;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private TimesheetStatus status = TimesheetStatus.DRAFT;
    @Column(nullable = false, precision = 6, scale = 2)
    private BigDecimal totalHours = BigDecimal.ZERO;
    @Column(nullable = false, precision = 6, scale = 2)
    private BigDecimal billableHours = BigDecimal.ZERO;
    private Instant submittedAt;
    @Column(length = 36)
    private String approverId;
    @Column(length = 500)
    private String decisionComment;
    private Instant decidedAt;
    @Column(nullable = false)
    private int resubmissionCount;
    @Version
    private long version;
}
