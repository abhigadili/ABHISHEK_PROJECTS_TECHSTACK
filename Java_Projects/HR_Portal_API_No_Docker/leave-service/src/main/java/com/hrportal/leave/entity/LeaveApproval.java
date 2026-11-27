package com.hrportal.leave.entity;

import com.hrportal.common.persistence.BaseEntity;
import com.hrportal.leave.entity.Enums.ApprovalAction;
import com.hrportal.leave.entity.Enums.ApprovalStage;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Leave approval history (append-only business log: who did what at which stage, with comment). */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "leave_approvals", indexes = @Index(name = "idx_approval_application", columnList = "applicationId"))
public class LeaveApproval extends BaseEntity {
    @Column(nullable = false, length = 36)
    private String applicationId;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private ApprovalStage stage;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ApprovalAction action;
    @Column(length = 36)
    private String actorId;
    @Column(length = 500)
    private String comment;
}
