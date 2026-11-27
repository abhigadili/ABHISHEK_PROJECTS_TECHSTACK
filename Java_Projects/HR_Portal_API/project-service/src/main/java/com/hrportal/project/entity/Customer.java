package com.hrportal.project.entity;

import java.math.BigDecimal;

import org.hibernate.annotations.SQLRestriction;

import com.hrportal.common.persistence.EncryptedStringConverter;
import com.hrportal.common.persistence.SoftDeletableEntity;
import com.hrportal.project.entity.Enums.CustomerStatus;

import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "customers", uniqueConstraints = @UniqueConstraint(name = "uk_customer_code", columnNames = "code"))
@SQLRestriction("deleted = false")
public class Customer extends SoftDeletableEntity {
    @Column(nullable = false, length = 30)
    private String code;
    @Column(nullable = false, length = 150)
    private String name;
    @Column(length = 80)
    private String industry;
    @Column(length = 200)
    private String website;
    @Column(length = 300)
    private String billingAddress;
    @Column(length = 150)
    private String billingEmail;
    /** Customer tax registration number (GST / VAT ...): encrypted at rest. */
    @Convert(converter = EncryptedStringConverter.class)
    @Column(length = 200)
    private String taxNumber;
    @Column(nullable = false)
    private int paymentTermsDays = 30;
    @Column(precision = 16, scale = 2)
    private BigDecimal creditLimit;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private CustomerStatus status = CustomerStatus.ACTIVE;
    @Column(length = 500)
    private String notes;
}
