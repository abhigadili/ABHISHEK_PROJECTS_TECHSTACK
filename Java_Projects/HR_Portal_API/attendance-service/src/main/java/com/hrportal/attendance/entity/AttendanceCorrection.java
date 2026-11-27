package com.hrportal.attendance.entity;

import java.time.Instant;
import java.time.LocalDate;

import com.hrportal.attendance.entity.Enums.RequestStatus;
import com.hrportal.common.persistence.BaseEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Attendance correction / regularization request (missing punch, wrong times). */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "attendance_corrections", indexes = {@Index(name = "idx_correction_employee", columnList = "employeeId,workDate"),
        @Index(name = "idx_correction_status", columnList = "status,managerId")})
public class AttendanceCorrection extends BaseEntity {
    @Column(nullable = false, length = 36)
    private String employeeId;
    @Column(length = 200)
    private String employeeName;
    @Column(nullable = false)
    private LocalDate workDate;
    @Column(nullable = false)
    private Instant requestedCheckIn;
    @Column(nullable = false)
    private Instant requestedCheckOut;
    @Column(nullable = false, length = 500)
    private String reason;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private RequestStatus status = RequestStatus.PENDING;
    @Column(length = 36)
    private String managerId;
    @Column(length = 36)
    private String reviewerId;
    @Column(length = 500)
    private String reviewComment;
    private Instant reviewedAt;
    @Column(nullable = false)
    private boolean escalated;
}
