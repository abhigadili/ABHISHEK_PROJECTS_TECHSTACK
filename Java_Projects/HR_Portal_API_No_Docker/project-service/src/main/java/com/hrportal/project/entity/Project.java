package com.hrportal.project.entity;

import java.math.BigDecimal;
import java.time.LocalDate;

import org.hibernate.annotations.SQLRestriction;

import com.hrportal.common.persistence.SoftDeletableEntity;
import com.hrportal.project.entity.Enums.BillingModel;
import com.hrportal.project.entity.Enums.ProjectStatus;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import jakarta.persistence.Version;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "projects", uniqueConstraints = @UniqueConstraint(name = "uk_project_code", columnNames = "code"),
        indexes = {@Index(name = "idx_project_customer", columnList = "customerId"), @Index(name = "idx_project_manager", columnList = "projectManagerId"),
                @Index(name = "idx_project_status", columnList = "status")})
@SQLRestriction("deleted = false")
public class Project extends SoftDeletableEntity {
    @Column(nullable = false, length = 30)
    private String code;
    @Column(nullable = false, length = 150)
    private String name;
    @Column(length = 1000)
    private String description;
    @Column(nullable = false, length = 36)
    private String customerId;
    @Column(nullable = false, length = 36)
    private String projectManagerId;
    @Column(nullable = false)
    private LocalDate startDate;
    private LocalDate endDate;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 12)
    private ProjectStatus status = ProjectStatus.PLANNED;
    @Column(precision = 16, scale = 2)
    private BigDecimal budget;
    @Column(length = 3)
    private String currency = "INR";
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private BillingModel billingModel = BillingModel.TIME_AND_MATERIAL;
    /** Hourly billing rate for time-and-material projects. */
    @Column(precision = 12, scale = 2)
    private BigDecimal billingRate;
    @Column(length = 36)
    private String billingContactId;
    @Column(length = 500)
    private String billingNotes;
    @Version
    private long version;
}
