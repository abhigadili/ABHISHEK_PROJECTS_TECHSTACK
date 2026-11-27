package com.hrportal.organization.entity;

import java.time.LocalDate;

import com.hrportal.common.persistence.SoftDeletableEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.SQLRestriction;

@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "organizations")
@SQLRestriction("deleted = false")
public class Organization extends SoftDeletableEntity {
    @Column(nullable = false, length = 150)
    private String name;
    @Column(length = 200)
    private String legalName;
    @Column(length = 60)
    private String registrationNumber;
    @Column(length = 200)
    private String website;
    @Column(length = 150)
    private String email;
    @Column(length = 30)
    private String phone;
    private LocalDate foundedOn;
    @Column(length = 300)
    private String address;
}
