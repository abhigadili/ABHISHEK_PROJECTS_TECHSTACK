package com.hrportal.timesheet.entity;

import org.hibernate.annotations.SQLRestriction;

import com.hrportal.common.persistence.SoftDeletableEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Task catalogue per project (task-based timesheets). */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "timesheet_tasks", uniqueConstraints = @UniqueConstraint(name = "uk_task_project_code", columnNames = {"projectId", "code"}),
        indexes = @Index(name = "idx_task_project", columnList = "projectId"))
@SQLRestriction("deleted = false")
public class TimesheetTask extends SoftDeletableEntity {
    @Column(nullable = false, length = 36)
    private String projectId;
    @Column(nullable = false, length = 30)
    private String code;
    @Column(nullable = false, length = 150)
    private String name;
    @Column(nullable = false)
    private boolean billable = true;
    @Column(nullable = false)
    private boolean active = true;
}
