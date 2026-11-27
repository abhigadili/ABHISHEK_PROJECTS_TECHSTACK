package com.hrportal.organization.entity;

import com.hrportal.common.persistence.SoftDeletableEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.SQLRestriction;

/** Company, office and work locations. */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "locations", uniqueConstraints = @UniqueConstraint(name = "uk_location_code", columnNames = "code"))
@SQLRestriction("deleted = false")
public class Location extends SoftDeletableEntity {
    @Column(nullable = false, length = 30)
    private String code;
    @Column(nullable = false, length = 120)
    private String name;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private LocationType type = LocationType.OFFICE;
    @Column(length = 200)
    private String addressLine;
    @Column(length = 80)
    private String city;
    @Column(length = 80)
    private String state;
    @Column(length = 80)
    private String country;
    @Column(length = 15)
    private String postalCode;
    @Column(length = 50)
    private String timezone;
    @Column(nullable = false)
    private boolean active = true;
}
