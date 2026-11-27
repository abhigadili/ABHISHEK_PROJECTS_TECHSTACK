package com.hrportal.employee.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Single-row counter for employee codes (EMP00001 ...). Read with a PESSIMISTIC_WRITE lock so concurrent onboardings never get the same number. */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "employee_sequence")
public class EmployeeSequence {
    @Id
    private Integer id;
    @Column(nullable = false)
    private long nextValue;
}
