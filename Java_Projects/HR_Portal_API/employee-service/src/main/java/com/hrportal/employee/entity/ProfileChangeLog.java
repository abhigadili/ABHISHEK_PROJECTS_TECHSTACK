package com.hrportal.employee.entity;

import com.hrportal.common.persistence.BaseEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Field-level profile update history: one row per changed field (who = createdBy, when = createdAt). Sensitive values are stored masked. */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "profile_change_log", indexes = @Index(name = "idx_profile_log_employee", columnList = "employeeId,createdAt"))
public class ProfileChangeLog extends BaseEntity {
    @Column(nullable = false, length = 36)
    private String employeeId;
    @Column(nullable = false, length = 60)
    private String fieldName;
    @Column(length = 500)
    private String oldValue;
    @Column(length = 500)
    private String newValue;
}
