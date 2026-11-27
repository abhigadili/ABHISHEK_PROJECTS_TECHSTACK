package com.hrportal.exit.entity;

import com.hrportal.common.persistence.BaseEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Configurable exit rules (single row). */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "exit_policy")
public class ExitPolicy extends BaseEntity {
    @Column(nullable = false)
    private int defaultNoticeDays = 60;
    @Column(nullable = false)
    private int maxWaiverDays = 30;
    /** A resignation cannot be withdrawn after HR has confirmed the last working day when false. */
    @Column(nullable = false)
    private boolean withdrawalAfterConfirmation;
    @Column(nullable = false)
    private int salaryDaysPerMonth = 30;
}
