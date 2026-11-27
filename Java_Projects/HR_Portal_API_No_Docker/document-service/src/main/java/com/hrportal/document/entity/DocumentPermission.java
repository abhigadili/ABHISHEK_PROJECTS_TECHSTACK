package com.hrportal.document.entity;

import java.time.Instant;

import com.hrportal.common.persistence.BaseEntity;
import com.hrportal.document.entity.Enums.AccessLevel;
import com.hrportal.document.entity.Enums.GranteeType;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Explicit access grant on one document: to an employee (by id) or to a role (by name). */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "document_permissions", indexes = @Index(name = "idx_permission_document", columnList = "documentId"))
public class DocumentPermission extends BaseEntity {
    @Column(nullable = false, length = 36)
    private String documentId;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private GranteeType granteeType;
    @Column(nullable = false, length = 60)
    private String granteeId;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private AccessLevel accessLevel = AccessLevel.DOWNLOAD;
    private Instant expiresAt;
}
