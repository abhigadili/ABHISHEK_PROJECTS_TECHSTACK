package com.hrportal.attendance.entity;

import java.time.Instant;

import com.hrportal.common.persistence.BaseEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Persisted by the stored procedure sp_monthly_attendance_summary (upsert on the unique key); payroll reads this snapshot. */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "monthly_attendance_summary", uniqueConstraints = @UniqueConstraint(name = "uk_summary_employee_month", columnNames = {"employeeId", "summaryYear", "summaryMonth"}))
public class MonthlySummary extends BaseEntity {
    @Column(nullable = false, length = 36)
    private String employeeId;
    @Column(nullable = false)
    private int summaryYear;
    @Column(nullable = false)
    private int summaryMonth;
    @Column(nullable = false)
    private int totalDays;
    @Column(nullable = false)
    private int workingDays;
    @Column(nullable = false)
    private int presentDays;
    @Column(nullable = false)
    private int halfDays;
    @Column(nullable = false)
    private int absentDays;
    @Column(nullable = false)
    private int leaveDays;
    @Column(nullable = false)
    private int holidays;
    @Column(nullable = false)
    private int weeklyOffs;
    @Column(nullable = false)
    private int wfhDays;
    @Column(nullable = false)
    private int missingPunches;
    @Column(nullable = false)
    private int lateCount;
    @Column(nullable = false)
    private int lateMinutes;
    @Column(nullable = false)
    private int earlyCount;
    @Column(nullable = false)
    private int workedMinutes;
    @Column(nullable = false)
    private int overtimeMinutes;
    @Column(nullable = false)
    private Instant generatedAt;
}
