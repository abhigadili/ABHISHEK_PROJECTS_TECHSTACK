package com.hrportal.attendance.entity;

import java.time.Instant;
import java.time.LocalDate;

import com.hrportal.attendance.entity.Enums.AttendanceStatus;
import com.hrportal.attendance.entity.Enums.Source;
import com.hrportal.attendance.entity.Enums.WorkMode;
import com.hrportal.common.persistence.BaseEntity;

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

/** One row per employee per day (unique key) - the daily attendance record. */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "attendance_records", uniqueConstraints = @UniqueConstraint(name = "uk_attendance_employee_date", columnNames = {"employeeId", "workDate"}),
        indexes = @Index(name = "idx_attendance_date", columnList = "workDate"))
public class AttendanceRecord extends BaseEntity {
    @Column(nullable = false, length = 36)
    private String employeeId;
    @Column(nullable = false)
    private LocalDate workDate;
    private Instant checkIn;
    private Instant checkOut;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private WorkMode workMode = WorkMode.OFFICE;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 15)
    private AttendanceStatus status = AttendanceStatus.PRESENT;
    @Column(nullable = false)
    private int workedMinutes;
    @Column(nullable = false)
    private int lateMinutes;
    @Column(nullable = false)
    private int earlyDepartureMinutes;
    @Column(nullable = false)
    private int overtimeMinutes;
    @Column(length = 36)
    private String shiftId;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 12)
    private Source source = Source.WEB;
    @Column(length = 300)
    private String remarks;
    @Version
    private long version;
}
