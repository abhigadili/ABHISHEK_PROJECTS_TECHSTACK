package com.hrportal.leave.entity;

import org.hibernate.annotations.SQLRestriction;

import com.hrportal.common.persistence.SoftDeletableEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "leave_types", uniqueConstraints = @UniqueConstraint(name = "uk_leave_type_code", columnNames = "code"))
@SQLRestriction("deleted = false")
public class LeaveType extends SoftDeletableEntity {
    @Column(nullable = false, length = 20)
    private String code;
    @Column(nullable = false, length = 80)
    private String name;
    @Column(length = 300)
    private String description;
    /** Unpaid types do not consume a balance and are deducted from salary by payroll. */
    @Column(nullable = false)
    private boolean paid = true;
    /** Types without a balance (e.g. unpaid leave) skip the balance check. */
    @Column(nullable = false)
    private boolean balanceTracked = true;
    @Column(nullable = false)
    private boolean halfDayAllowed = true;
    /** When set, an attachment is mandatory for applications of at least this many days (e.g. sick leave >= 3 days). */
    private Integer attachmentRequiredFromDays;
    @Column(nullable = false)
    private boolean requiresHrApproval;
    /** MALE / FEMALE or null for everybody (maternity / paternity). */
    @Column(length = 10)
    private String genderRestriction;
    @Column(nullable = false)
    private boolean active = true;
}
