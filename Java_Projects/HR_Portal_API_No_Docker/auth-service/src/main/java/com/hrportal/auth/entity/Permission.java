package com.hrportal.auth.entity;

import com.hrportal.common.persistence.BaseEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Fine-grained capability (e.g. LEAVE_APPROVE). Roles are bundles of permissions; both end up in the JWT. */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "permissions")
public class Permission extends BaseEntity {
    @Column(nullable = false, unique = true, length = 60)
    private String code;
    @Column(length = 255)
    private String description;
}
