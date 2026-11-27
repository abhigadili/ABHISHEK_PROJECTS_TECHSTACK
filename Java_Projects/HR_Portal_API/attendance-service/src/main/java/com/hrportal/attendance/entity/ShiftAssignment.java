package com.hrportal.attendance.entity;

import java.time.LocalDate;

import com.hrportal.common.persistence.BaseEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "shift_assignments", indexes = @Index(name = "idx_assignment_employee", columnList = "employeeId,effectiveFrom"))
public class ShiftAssignment extends BaseEntity {
    @Column(nullable = false, length = 36)
    private String employeeId;
    @Column(nullable = false, length = 36)
    private String shiftId;
    @Column(nullable = false)
    private LocalDate effectiveFrom;
    private LocalDate effectiveTo;
}
