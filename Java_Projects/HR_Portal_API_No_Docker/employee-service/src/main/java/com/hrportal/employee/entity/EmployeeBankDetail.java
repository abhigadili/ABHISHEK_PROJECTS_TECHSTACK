package com.hrportal.employee.entity;

import com.hrportal.common.persistence.BaseEntity;
import com.hrportal.common.persistence.EncryptedStringConverter;

import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** One-to-One with Employee. Account number and IFSC are encrypted at rest; API responses only ever show a masked value. */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "employee_bank_details")
public class EmployeeBankDetail extends BaseEntity {
    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "employee_id", nullable = false, unique = true)
    private Employee employee;
    @Column(name = "employee_id", insertable = false, updatable = false, length = 36)
    private String employeeId;
    @Column(nullable = false, length = 120)
    private String bankName;
    @Column(length = 120)
    private String branch;
    @Column(nullable = false, length = 120)
    private String accountHolderName;
    @Convert(converter = EncryptedStringConverter.class)
    @Column(nullable = false, length = 200)
    private String accountNumber;
    @Convert(converter = EncryptedStringConverter.class)
    @Column(length = 200)
    private String ifscCode;
    @Column(length = 20)
    private String accountType;
}
