package com.hrportal.leave.entity;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

import com.hrportal.common.persistence.BaseEntity;
import com.hrportal.leave.entity.Enums.ApprovalStage;
import com.hrportal.leave.entity.Enums.LeaveStatus;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "leave_applications", indexes = {
        @Index(name = "idx_leave_employee_dates", columnList = "employeeId,fromDate,toDate"),
        @Index(name = "idx_leave_manager_status", columnList = "managerId,status,stage"),
        @Index(name = "idx_leave_status_stage", columnList = "status,stage")})
public class LeaveApplication extends BaseEntity {
    @Column(nullable = false, length = 36)
    private String employeeId;
    @Column(length = 200)
    private String employeeName;
    @Column(nullable = false, length = 36)
    private String leaveTypeId;
    @Column(nullable = false)
    private LocalDate fromDate;
    @Column(nullable = false)
    private LocalDate toDate;
    @Column(nullable = false)
    private boolean halfDayStart;
    @Column(nullable = false)
    private boolean halfDayEnd;
    @Column(nullable = false, precision = 5, scale = 1)
    private BigDecimal days;
    @Column(length = 500)
    private String reason;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 12)
    private LeaveStatus status = LeaveStatus.PENDING;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private ApprovalStage stage = ApprovalStage.MANAGER;
    @Column(length = 36)
    private String managerId;
    @Column(nullable = false)
    private boolean cancelRequested;
    @Column(length = 300)
    private String cancelReason;
    @Column(nullable = false)
    private Instant appliedAt = Instant.now();
    private Instant decidedAt;
    @Version
    private long version;
}
