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

@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "designations", uniqueConstraints = @UniqueConstraint(name = "uk_designation_code", columnNames = "code"))
@SQLRestriction("deleted = false")
public class Designation extends SoftDeletableEntity {
    @Column(nullable = false, length = 30)
    private String code;
    @Column(nullable = false, length = 120)
    private String title;
    @Column(length = 36)
    private String jobGradeId;
    @Column(length = 300)
    private String description;
    @Column(nullable = false)
    private boolean active = true;
}
