package com.hrportal.tax.entity;

import com.hrportal.common.persistence.BaseEntity;
import com.hrportal.tax.entity.Enums.DocType;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Employee tax documents (Form 16 parts, income-tax statements ...): a pointer to the file kept by the Document service. */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "tax_documents", indexes = @Index(name = "idx_taxdoc_employee", columnList = "employeeId,financialYear"))
public class TaxDocument extends BaseEntity {
    @Column(nullable = false, length = 36)
    private String employeeId;
    @Column(nullable = false, length = 7)
    private String financialYear;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private DocType docType;
    @Column(nullable = false, length = 36)
    private String documentId;
    @Column(length = 255)
    private String fileName;
}
