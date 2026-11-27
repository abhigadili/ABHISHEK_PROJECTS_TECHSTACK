package com.hrportal.timesheet.entity;

import java.math.BigDecimal;
import java.time.LocalDate;

import com.hrportal.common.persistence.BaseEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Hours booked on a project (and optionally a task) on one day. */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "timesheet_entries",
        uniqueConstraints = @UniqueConstraint(name = "uk_entry_unique", columnNames = {"timesheetId", "projectId", "taskKey", "workDate"}),
        indexes = {@Index(name = "idx_entry_timesheet", columnList = "timesheetId"), @Index(name = "idx_entry_project_date", columnList = "projectId,workDate")})
public class TimesheetEntry extends BaseEntity {
    @Column(nullable = false, length = 36)
    private String timesheetId;
    @Column(nullable = false, length = 36)
    private String employeeId;
    @Column(nullable = false, length = 36)
    private String projectId;
    @Column(length = 36)
    private String taskId;
    /** taskId or "-" : part of the unique key (MySQL treats NULLs as distinct). */
    @Column(nullable = false, length = 36)
    private String taskKey = "-";
    @Column(nullable = false)
    private LocalDate workDate;
    @Column(nullable = false, precision = 4, scale = 2)
    private BigDecimal hours;
    @Column(nullable = false)
    private boolean billable;
    @Column(length = 36)
    private String projectManagerId;
    @Column(length = 300)
    private String description;
}
