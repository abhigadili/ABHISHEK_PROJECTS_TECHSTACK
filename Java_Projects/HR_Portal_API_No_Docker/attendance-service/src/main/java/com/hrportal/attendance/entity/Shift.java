package com.hrportal.attendance.entity;

import java.time.LocalTime;

import org.hibernate.annotations.SQLRestriction;

import com.hrportal.common.persistence.SoftDeletableEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** A work shift with configurable hours, grace period, day-length thresholds and weekly off days. */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "shifts", uniqueConstraints = @UniqueConstraint(name = "uk_shift_code", columnNames = "code"))
@SQLRestriction("deleted = false")
public class Shift extends SoftDeletableEntity {
    @Column(nullable = false, length = 20)
    private String code;
    @Column(nullable = false, length = 80)
    private String name;
    @Column(nullable = false)
    private LocalTime startTime;
    @Column(nullable = false)
    private LocalTime endTime;
    @Column(nullable = false)
    private int graceMinutes = 15;
    /** Minutes of a standard day (overtime starts after this plus the threshold). */
    @Column(nullable = false)
    private int standardMinutes = 480;
    /** Worked minutes needed for a full PRESENT day. */
    @Column(nullable = false)
    private int fullDayMinutes = 420;
    /** Worked minutes needed for a HALF_DAY. */
    @Column(nullable = false)
    private int halfDayMinutes = 240;
    @Column(nullable = false)
    private int overtimeThresholdMinutes = 30;
    /** Comma separated weekly off days, e.g. SAT,SUN. */
    @Column(nullable = false, length = 40)
    private String weeklyOffs = "SAT,SUN";
    @Column(name = "is_default", nullable = false)
    private boolean defaultShift;
    @Column(nullable = false)
    private boolean active = true;
}
