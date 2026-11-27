package com.hrportal.tax.entity;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Local employee list (name, status) kept current by employee.* events - used for reminders and display names. */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "tax_employees")
public class TaxEmployee {
    @Id
    @Column(length = 36)
    private String employeeId;
    @Column(length = 200)
    private String fullName;
    @Column(nullable = false, length = 15)
    private String status = "ACTIVE";
    @Column(nullable = false)
    private Instant updatedAt = Instant.now();
}
