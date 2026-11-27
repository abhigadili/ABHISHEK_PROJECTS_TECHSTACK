package com.hrportal.holiday.entity;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

import org.hibernate.annotations.SQLRestriction;

import com.hrportal.common.persistence.SoftDeletableEntity;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "holidays", indexes = {@Index(name = "idx_holiday_date", columnList = "holidayDate"), @Index(name = "idx_holiday_year", columnList = "holidayYear")})
@SQLRestriction("deleted = false")
public class Holiday extends SoftDeletableEntity {
    @Column(nullable = false, length = 150)
    private String name;
    @Column(nullable = false)
    private LocalDate holidayDate;
    @Column(nullable = false)
    private int holidayYear;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 15)
    private HolidayType type = HolidayType.MANDATORY;
    @Column(length = 300)
    private String description;

    @ElementCollection(fetch = FetchType.LAZY)
    @CollectionTable(name = "holiday_scopes", joinColumns = @JoinColumn(name = "holiday_id"))
    private List<HolidayScope> scopes = new ArrayList<>();

    /** Entity callback: the year column is always derived from the date, so the two can never disagree. */
    @PrePersist
    @PreUpdate
    void syncYear() {
        if (holidayDate != null) holidayYear = holidayDate.getYear();
    }
}
