package com.hrportal.project.entity;

import org.hibernate.annotations.SQLRestriction;

import com.hrportal.common.persistence.SoftDeletableEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "customer_contacts", indexes = @Index(name = "idx_contact_customer", columnList = "customerId"))
@SQLRestriction("deleted = false")
public class CustomerContact extends SoftDeletableEntity {
    @Column(nullable = false, length = 36)
    private String customerId;
    @Column(nullable = false, length = 120)
    private String name;
    @Column(length = 150)
    private String email;
    @Column(length = 25)
    private String phone;
    @Column(length = 100)
    private String designation;
    @Column(name = "is_primary", nullable = false)
    private boolean primaryContact;
}
