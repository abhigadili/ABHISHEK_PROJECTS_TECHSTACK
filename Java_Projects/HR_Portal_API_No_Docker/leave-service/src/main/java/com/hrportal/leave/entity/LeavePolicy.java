package com.hrportal.leave.entity;


import org.hibernate.annotations.SQLRestriction;

import com.hrportal.common.persistence.SoftDeletableEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** A policy bundles the approval rule (HR approval above a number of days); its per-type entitlements live in LeavePolicyEntitlement (composite key). */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "leave_policies")
@SQLRestriction("deleted = false")
public class LeavePolicy extends SoftDeletableEntity {
    @Column(nullable = false, length = 100)
    private String name;
    @Column(length = 300)
    private String description;
    @Column(name = "is_default", nullable = false)
    private boolean defaultPolicy;
    @Column(nullable = false)
    private boolean active = true;
    /** Applications longer than this need HR approval after the manager's approval. */
    @Column(nullable = false)
    private int hrApprovalThresholdDays = 5;

}
