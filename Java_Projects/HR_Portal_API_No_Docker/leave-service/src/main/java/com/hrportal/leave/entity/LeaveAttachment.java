package com.hrportal.leave.entity;

import com.hrportal.common.persistence.BaseEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Reference to a file stored by the Document service (category LEAVE_ATTACHMENT); this service keeps only the pointer. */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "leave_attachments", indexes = @Index(name = "idx_attachment_application", columnList = "applicationId"))
public class LeaveAttachment extends BaseEntity {
    @Column(nullable = false, length = 36)
    private String applicationId;
    @Column(nullable = false, length = 36)
    private String documentId;
    @Column(length = 255)
    private String fileName;
}
