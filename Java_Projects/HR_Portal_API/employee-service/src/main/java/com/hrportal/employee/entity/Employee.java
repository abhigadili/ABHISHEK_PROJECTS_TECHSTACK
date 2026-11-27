package com.hrportal.employee.entity;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

import org.hibernate.annotations.SQLRestriction;

import com.hrportal.common.persistence.EncryptedStringConverter;
import com.hrportal.common.persistence.SoftDeletableEntity;
import com.hrportal.common.util.LogMasker;
import com.hrportal.employee.entity.Enums.EmployeeStatus;
import com.hrportal.employee.entity.Enums.EmploymentType;
import com.hrportal.employee.entity.Enums.Gender;
import com.hrportal.employee.entity.Enums.MaritalStatus;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Embedded;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToMany;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import jakarta.persistence.Version;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Aggregate root of the Employee service. Department / designation / location / manager / grade are plain UUID
 * references to data owned by other services (no cross-database foreign keys).
 * Optimistic locking: {@code @Version} makes two concurrent edits of the same employee fail with a 409 instead of
 * silently overwriting each other. Soft deletion: {@code @SQLRestriction} hides flagged rows from every query.
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "employees",
        uniqueConstraints = {@UniqueConstraint(name = "uk_employee_code", columnNames = "employeeCode"),
                @UniqueConstraint(name = "uk_employee_work_email", columnNames = "workEmail")},
        indexes = {@Index(name = "idx_employee_manager", columnList = "managerId"),
                @Index(name = "idx_employee_department", columnList = "departmentId"),
                @Index(name = "idx_employee_status", columnList = "status"),
                @Index(name = "idx_employee_name", columnList = "lastName,firstName")})
@SQLRestriction("deleted = false")
public class Employee extends SoftDeletableEntity {
    @Column(nullable = false, length = 20)
    private String employeeCode;
    @Column(nullable = false, length = 80)
    private String firstName;
    @Column(length = 80)
    private String middleName;
    @Column(nullable = false, length = 80)
    private String lastName;
    @Column(nullable = false, length = 150)
    private String workEmail;
    private LocalDate dateOfBirth;
    @Enumerated(EnumType.STRING)
    @Column(length = 15)
    private Gender gender;
    @Enumerated(EnumType.STRING)
    @Column(length = 15)
    private MaritalStatus maritalStatus;
    @Column(length = 60)
    private String nationality;
    @Column(length = 5)
    private String bloodGroup;
    @Column(nullable = false)
    private LocalDate joiningDate;
    private LocalDate confirmationDate;
    private LocalDate exitDate;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 15)
    private EmploymentType employmentType = EmploymentType.FULL_TIME;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 15)
    private EmployeeStatus status = EmployeeStatus.ACTIVE;
    @Column(nullable = false, length = 36)
    private String departmentId;
    @Column(nullable = false, length = 36)
    private String designationId;
    @Column(nullable = false, length = 36)
    private String locationId;
    @Column(length = 36)
    private String managerId;
    @Column(length = 36)
    private String jobGradeId;
    @Column(nullable = false)
    private int noticePeriodDays = 60;

    /** Tax identifier and national id are AES-GCM encrypted at rest by the JPA converter. */
    @Convert(converter = EncryptedStringConverter.class)
    @Column(length = 200)
    private String panNumber;
    @Convert(converter = EncryptedStringConverter.class)
    @Column(length = 200)
    private String nationalId;

    @Embedded
    private ContactInfo contact = new ContactInfo();

    /** One-to-Many (unidirectional, FK in the child table). Cascade + orphanRemoval: the list IS the source of truth. */
    @OneToMany(cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @JoinColumn(name = "employee_id", nullable = false)
    private List<EmployeeAddress> addresses = new ArrayList<>();

    @OneToMany(cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @JoinColumn(name = "employee_id", nullable = false)
    private List<EmergencyContact> emergencyContacts = new ArrayList<>();

    @Version
    private long version;

    /** Entity callbacks: normalise before every insert / update so the data is consistent whichever code path saved it. */
    @PrePersist
    @PreUpdate
    void normalise() {
        if (workEmail != null) workEmail = workEmail.trim().toLowerCase();
        if (employeeCode != null) employeeCode = employeeCode.trim().toUpperCase();
        if (bloodGroup != null) bloodGroup = bloodGroup.trim().toUpperCase();
    }

    public String getFullName() {
        return (firstName + (middleName == null || middleName.isBlank() ? "" : " " + middleName) + " " + lastName).trim();
    }

    /** Read-only derived property used by the response DTO (the raw identifier never leaves the service). */
    public String getPanMasked() {
        return panNumber == null ? null : LogMasker.maskTail(panNumber, 4);
    }
}
