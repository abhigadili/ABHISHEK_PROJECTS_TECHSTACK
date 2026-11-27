package com.hrportal.document.entity;

import java.time.Instant;
import java.time.LocalDate;

import org.hibernate.annotations.SQLRestriction;

import com.hrportal.common.persistence.SoftDeletableEntity;
import com.hrportal.document.entity.Enums.DocumentStatus;
import com.hrportal.document.entity.Enums.Source;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Document METADATA only; the bytes live in the file store (storagePath, never exposed through the API). */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "documents", indexes = {@Index(name = "idx_document_owner", columnList = "ownerEmployeeId,categoryId,currentVersion"),
        @Index(name = "idx_document_expiry", columnList = "expiryDate"), @Index(name = "idx_document_status", columnList = "status")})
@SQLRestriction("deleted = false")
public class Document extends SoftDeletableEntity {
    @Column(nullable = false, length = 36)
    private String ownerEmployeeId;
    @Column(nullable = false, length = 36)
    private String categoryId;
    @Column(nullable = false, length = 200)
    private String title;
    @Column(nullable = false, length = 255)
    private String fileName;
    @Column(nullable = false, length = 100)
    private String contentType;
    @Column(nullable = false)
    private long sizeBytes;
    @Column(nullable = false, length = 64)
    private String sha256;
    @Column(nullable = false, length = 300)
    private String storagePath;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private DocumentStatus status = DocumentStatus.UPLOADED;
    private LocalDate expiryDate;
    @Column(length = 100)
    private String uploadedBy;
    @Column(length = 100)
    private String decidedBy;
    private Instant decidedAt;
    @Column(length = 500)
    private String rejectionReason;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private Source source = Source.MANUAL;
    @Column(nullable = false)
    private int versionNumber = 1;
    @Column(nullable = false)
    private boolean currentVersion = true;
    @Column(length = 36)
    private String previousVersionId;
    @Version
    private long optimisticVersion;
}
