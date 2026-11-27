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

@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "wfh_requests", indexes = {@Index(name = "idx_wfh_employee", columnList = "employeeId,fromDate"),
        @Index(name = "idx_wfh_status", columnList = "status,managerId")})
public class WfhRequest extends BaseEntity {
    @Column(nullable = false, length = 36)
    private String employeeId;
    @Column(length = 200)
    private String employeeName;
    @Column(nullable = false)
    private LocalDate fromDate;
    @Column(nullable = false)
    private LocalDate toDate;
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
}
