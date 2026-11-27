package com.hrportal.attendance.entity;

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

/** One row per approved leave day, maintained from leave.approved / leave.cancelled events (attendance never reads the leave database). */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "approved_leave_days", uniqueConstraints = @UniqueConstraint(name = "uk_leave_day", columnNames = {"employeeId", "leaveDate", "applicationId"}),
        indexes = @Index(name = "idx_leave_day_employee", columnList = "employeeId,leaveDate"))
public class ApprovedLeaveDay extends BaseEntity {
    @Column(nullable = false, length = 36)
    private String employeeId;
    @Column(nullable = false)
    private LocalDate leaveDate;
    @Column(nullable = false, length = 36)
    private String applicationId;
}
