package com.hrportal.project.entity;

import com.hrportal.common.persistence.BaseEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Project history: status / manager / budget / dates / team changes (who = createdBy, when = createdAt). */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "project_history", indexes = @Index(name = "idx_project_history", columnList = "projectId,createdAt"))
public class ProjectHistory extends BaseEntity {
    @Column(nullable = false, length = 36)
    private String projectId;
    @Column(nullable = false, length = 40)
    private String changeType;
    @Column(length = 500)
    private String oldValue;
    @Column(length = 500)
    private String newValue;
}
