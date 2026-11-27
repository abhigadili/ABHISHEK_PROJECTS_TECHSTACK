package com.hrportal.exit.entity;

import com.hrportal.common.persistence.BaseEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Exit history: every status change with the actor (createdBy) and comment. */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "exit_history", indexes = @Index(name = "idx_exit_history", columnList = "resignationId,createdAt"))
public class ExitHistory extends BaseEntity {
    @Column(nullable = false, length = 36)
    private String resignationId;
    @Column(length = 20)
    private String fromStatus;
    @Column(nullable = false, length = 20)
    private String toStatus;
    @Column(length = 500)
    private String comment;
}
