package com.hrportal.tax.entity;

import java.time.Instant;

import com.hrportal.common.persistence.BaseEntity;
import com.hrportal.tax.entity.Enums.ProofStatus;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Supporting proof: the file lives in the Document service (documentId); this row tracks review state. A rejected proof can be resubmitted as a new row. */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "tax_proofs", indexes = {@Index(name = "idx_proof_investment", columnList = "investmentId"), @Index(name = "idx_proof_status", columnList = "status")})
public class TaxProof extends BaseEntity {
    @Column(nullable = false, length = 36)
    private String investmentId;
    @Column(nullable = false, length = 36)
    private String declarationId;
    @Column(nullable = false, length = 36)
    private String documentId;
    @Column(length = 255)
    private String fileName;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private ProofStatus status = ProofStatus.SUBMITTED;
    @Column(length = 36)
    private String reviewerId;
    @Column(length = 500)
    private String reviewerComment;
    private Instant reviewedAt;
    @Column(nullable = false)
    private int attemptNumber = 1;
}
