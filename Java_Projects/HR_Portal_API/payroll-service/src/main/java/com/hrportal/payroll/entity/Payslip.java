package com.hrportal.payroll.entity;

import java.time.Instant;

import com.hrportal.common.persistence.BaseEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Payslip metadata; the PDF itself lives in the file store (storagePath). */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "payslips", uniqueConstraints = @UniqueConstraint(name = "uk_payslip_entry", columnNames = "entryId"),
        indexes = @Index(name = "idx_payslip_employee", columnList = "employeeId,payrollMonth"))
public class Payslip extends BaseEntity {
    @Column(nullable = false, length = 36)
    private String entryId;
    @Column(nullable = false, length = 36)
    private String runId;
    @Column(nullable = false, length = 36)
    private String employeeId;
    @Column(nullable = false, length = 7)
    private String payrollMonth;
    @Column(nullable = false, length = 300)
    private String storagePath;
    @Column(nullable = false, length = 150)
    private String fileName;
    @Column(nullable = false)
    private long sizeBytes;
    @Column(nullable = false, length = 64)
    private String sha256;
    @Column(nullable = false)
    private Instant generatedAt = Instant.now();
}
