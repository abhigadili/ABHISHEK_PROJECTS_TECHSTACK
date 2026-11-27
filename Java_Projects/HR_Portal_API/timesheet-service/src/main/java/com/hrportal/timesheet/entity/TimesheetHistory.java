package com.hrportal.timesheet.entity;

import com.hrportal.common.persistence.BaseEntity;
import com.hrportal.timesheet.entity.Enums.HistoryAction;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Timesheet history / approval trail. */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "timesheet_history", indexes = @Index(name = "idx_ts_history", columnList = "timesheetId,createdAt"))
public class TimesheetHistory extends BaseEntity {
    @Column(nullable = false, length = 36)
    private String timesheetId;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 15)
    private HistoryAction action;
    @Column(length = 36)
    private String actorId;
    @Column(length = 500)
    private String comment;
}
