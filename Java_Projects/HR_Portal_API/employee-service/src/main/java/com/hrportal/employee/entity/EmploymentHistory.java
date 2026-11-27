package com.hrportal.employee.entity;

import java.time.LocalDate;

import com.hrportal.common.persistence.BaseEntity;
import com.hrportal.employee.entity.Enums.ChangeType;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Business history of the employment itself: joined, promoted, transferred, manager changed, status changed. */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "employment_history", indexes = @Index(name = "idx_history_employee", columnList = "employeeId,effectiveDate"))
public class EmploymentHistory extends BaseEntity {
    @Column(nullable = false, length = 36)
    private String employeeId;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ChangeType changeType;
    @Column(length = 500)
    private String fromValue;
    @Column(length = 500)
    private String toValue;
    @Column(nullable = false)
    private LocalDate effectiveDate;
    @Column(length = 300)
    private String reason;
}
