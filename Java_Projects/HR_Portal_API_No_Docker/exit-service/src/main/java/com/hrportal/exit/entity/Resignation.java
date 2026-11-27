package com.hrportal.exit.entity;

import java.time.Instant;
import java.time.LocalDate;

import com.hrportal.common.persistence.BaseEntity;
import com.hrportal.exit.entity.Enums.ResignationStatus;

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
@Table(name = "resignations", indexes = {@Index(name = "idx_resignation_employee", columnList = "employeeId,status"), @Index(name = "idx_resignation_manager", columnList = "managerId,status"),
        @Index(name = "idx_resignation_status", columnList = "status")})
public class Resignation extends BaseEntity {
    @Column(nullable = false, length = 36)
    private String employeeId;
    @Column(length = 200)
    private String employeeName;
    @Column(length = 36)
    private String managerId;
    @Column(length = 36)
    private String departmentId;
    private LocalDate joiningDate;
    @Column(nullable = false)
    private LocalDate submittedOn;
    @Column(nullable = false)
    private LocalDate requestedLastWorkingDay;
    private LocalDate confirmedLastWorkingDay;
    @Column(nullable = false)
    private int noticePeriodDays;
    @Column(nullable = false)
    private int waiverDays;
    @Column(nullable = false, length = 1000)
    private String reason;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ResignationStatus status = ResignationStatus.SUBMITTED;
    @Column(length = 500)
    private String managerComment;
    @Column(length = 500)
    private String hrComment;
    private Instant completedAt;
    @Version
    private long version;
}
