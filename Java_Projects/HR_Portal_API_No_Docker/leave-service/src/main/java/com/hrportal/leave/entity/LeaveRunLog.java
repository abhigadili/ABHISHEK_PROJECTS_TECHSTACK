package com.hrportal.leave.entity;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Idempotency record for batch runs (monthly accrual, yearly carry-forward): the run key is the primary key, so a run can happen only once. */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "leave_run_log")
public class LeaveRunLog {
    @Id
    @Column(length = 60)
    private String runKey;
    @Column(nullable = false)
    private int recordsProcessed;
    @Column(nullable = false)
    private Instant executedAt = Instant.now();
    @Column(length = 100)
    private String executedBy;
}
