package com.hrportal.document.entity;

import com.hrportal.common.persistence.BaseEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Employee document history: upload, new versions, verification, decisions, permission changes and every download. */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "document_history", indexes = @Index(name = "idx_doc_history", columnList = "documentId,createdAt"))
public class DocumentHistory extends BaseEntity {
    @Column(nullable = false, length = 36)
    private String documentId;
    @Column(nullable = false, length = 30)
    private String action;
    @Column(length = 500)
    private String detail;
}
