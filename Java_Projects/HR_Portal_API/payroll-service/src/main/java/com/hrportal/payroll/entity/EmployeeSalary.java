package com.hrportal.payroll.entity;

import java.math.BigDecimal;
import java.time.LocalDate;

import com.hrportal.common.persistence.BaseEntity;
import com.hrportal.payroll.entity.Enums.SalaryStatus;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** An employee's salary assignment. INSERT / UPDATE triggers copy every version into salary_revision_history. */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "employee_salaries", indexes = @Index(name = "idx_salary_employee", columnList = "employeeId,status,effectiveFrom"))
public class EmployeeSalary extends BaseEntity {
    @Column(nullable = false, length = 36)
    private String employeeId;
    @Column(nullable = false, length = 36)
    private String structureId;
    @Column(nullable = false, precision = 14, scale = 2)
    private BigDecimal annualCtc;
    @Column(nullable = false, length = 3)
    private String currency = "INR";
    @Column(nullable = false)
    private LocalDate effectiveFrom;
    private LocalDate effectiveTo;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 12)
    private SalaryStatus status = SalaryStatus.ACTIVE;
    @Version
    private long version;
}
