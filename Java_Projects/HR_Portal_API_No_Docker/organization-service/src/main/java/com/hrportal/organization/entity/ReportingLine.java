package com.hrportal.organization.entity;

import java.time.Instant;

import com.hrportal.common.persistence.BaseEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** History of "who reported to whom": a new row opens (and the previous one closes) whenever an employee's manager changes. */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "reporting_lines", indexes = @Index(name = "idx_line_employee", columnList = "employeeId,effectiveTo"))
public class ReportingLine extends BaseEntity {
    @Column(nullable = false, length = 36)
    private String employeeId;
    @Column(length = 36)
    private String managerId;
    @Column(nullable = false)
    private Instant effectiveFrom = Instant.now();
    private Instant effectiveTo;
}
