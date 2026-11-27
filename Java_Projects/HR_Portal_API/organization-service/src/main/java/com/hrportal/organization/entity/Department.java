package com.hrportal.organization.entity;

import com.hrportal.common.persistence.SoftDeletableEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.SQLRestriction;

/** Self-referencing hierarchy through {@code parentId} (department tree). */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "departments", uniqueConstraints = @UniqueConstraint(name = "uk_dept_code", columnNames = "code"))
@SQLRestriction("deleted = false")
public class Department extends SoftDeletableEntity {
    @Column(nullable = false, length = 30)
    private String code;
    @Column(nullable = false, length = 120)
    private String name;
    @Column(length = 36)
    private String businessUnitId;
    @Column(length = 36)
    private String parentId;
    @Column(length = 36)
    private String headEmployeeId;
    @Column(length = 30)
    private String costCenter;
    @Column(nullable = false)
    private boolean active = true;
}
