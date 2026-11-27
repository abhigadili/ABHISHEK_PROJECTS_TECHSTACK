package com.hrportal.attendance.entity;

import java.time.LocalDate;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Local copy of company holidays (holiday id is the key), loaded through Feign / WebClient and kept current by holiday.changed events. */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "holiday_snapshots", indexes = @Index(name = "idx_holiday_snapshot_date", columnList = "holidayDate"))
public class HolidaySnapshot {
    @Id
    @Column(length = 36)
    private String holidayId;
    @Column(nullable = false)
    private LocalDate holidayDate;
    @Column(length = 150)
    private String name;
    /** null = applies to every location. */
    @Column(length = 36)
    private String locationId;
}
