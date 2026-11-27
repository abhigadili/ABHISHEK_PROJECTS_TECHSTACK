package com.hrportal.exit.entity;

import java.time.Instant;
import java.time.LocalDate;

import com.hrportal.common.persistence.BaseEntity;
import com.hrportal.exit.entity.Enums.TaskStatus;

import jakarta.persistence.Column;
import jakarta.persistence.DiscriminatorColumn;
import jakarta.persistence.DiscriminatorType;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Index;
import jakarta.persistence.Inheritance;
import jakarta.persistence.InheritanceType;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * ENTITY INHERITANCE (single table, discriminator column {@code task_type}): the common part of every exit task. The subclasses
 * (checklist item, department clearance, knowledge transfer, asset return, access revocation) add their own nullable columns to the
 * same table, and one repository query returns all of them polymorphically.
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "exit_tasks", indexes = @Index(name = "idx_task_resignation", columnList = "resignationId,status"))
@Inheritance(strategy = InheritanceType.SINGLE_TABLE)
@DiscriminatorColumn(name = "task_type", discriminatorType = DiscriminatorType.STRING, length = 12)
public abstract class ExitTask extends BaseEntity {
    @Column(nullable = false, length = 36)
    private String resignationId;
    @Column(nullable = false, length = 200)
    private String title;
    private LocalDate dueDate;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 8)
    private TaskStatus status = TaskStatus.PENDING;
    private Instant completedAt;
    @Column(length = 100)
    private String completedBy;
    @Column(length = 500)
    private String remarks;

    /** Discriminator value exposed to the API. */
    public abstract String kind();
}
