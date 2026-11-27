package com.hrportal.document.entity;

import org.hibernate.annotations.SQLRestriction;

import com.hrportal.common.persistence.SoftDeletableEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Document category with its access policy: who may read other employees' documents of this category and whether employees may upload it themselves. */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "document_categories", uniqueConstraints = @UniqueConstraint(name = "uk_doc_category_code", columnNames = "code"))
@SQLRestriction("deleted = false")
public class DocumentCategory extends SoftDeletableEntity {
    @Column(nullable = false, length = 30)
    private String code;
    @Column(nullable = false, length = 100)
    private String name;
    @Column(length = 300)
    private String description;
    /** column is named is_sensitive: SENSITIVE is a reserved word in MySQL 8 */
    @Column(name = "is_sensitive", nullable = false)
    private boolean sensitive;
    @Column(nullable = false)
    private boolean requiresVerification = true;
    @Column(nullable = false)
    private boolean selfUploadAllowed = true;
    /** Comma separated roles that may read documents of this category of OTHER employees. */
    @Column(nullable = false, length = 200)
    private String readRoles = "HR_ADMIN,SUPER_ADMIN";
    private Integer defaultExpiryMonths;
    @Column(nullable = false)
    private boolean active = true;
}
