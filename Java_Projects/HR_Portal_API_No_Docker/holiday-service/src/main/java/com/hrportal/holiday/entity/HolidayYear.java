package com.hrportal.holiday.entity;

import java.time.LocalDate;

import com.hrportal.common.persistence.BaseEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Holiday-year configuration (calendar vs. financial year boundaries). */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "holiday_years", uniqueConstraints = @UniqueConstraint(name = "uk_holiday_year", columnNames = "yearNumber"))
public class HolidayYear extends BaseEntity {
    @Column(nullable = false)
    private int yearNumber;
    @Column(nullable = false)
    private LocalDate startDate;
    @Column(nullable = false)
    private LocalDate endDate;
    @Column(nullable = false)
    private boolean active = true;
    @Column(length = 200)
    private String description;
}
