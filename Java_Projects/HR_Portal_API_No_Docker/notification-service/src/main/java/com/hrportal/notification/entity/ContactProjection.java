package com.hrportal.notification.entity;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** E-mail address and name of every employee, kept by employee.* events - resolves "notify employee X" into an address. */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "employee_contacts")
public class ContactProjection {
    @Id
    @Column(length = 36)
    private String employeeId;
    @Column(length = 200)
    private String fullName;
    @Column(length = 150)
    private String email;
    @Column(nullable = false)
    private Instant updatedAt = Instant.now();
}
