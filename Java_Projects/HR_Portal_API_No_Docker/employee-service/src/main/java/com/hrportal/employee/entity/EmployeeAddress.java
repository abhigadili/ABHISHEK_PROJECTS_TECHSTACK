package com.hrportal.employee.entity;

import com.hrportal.common.persistence.BaseEntity;
import com.hrportal.employee.entity.Enums.AddressType;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "employee_addresses")
public class EmployeeAddress extends BaseEntity {
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 15)
    private AddressType type = AddressType.CURRENT;
    @Column(nullable = false, length = 150)
    private String line1;
    @Column(length = 150)
    private String line2;
    @Column(nullable = false, length = 80)
    private String city;
    @Column(length = 80)
    private String state;
    @Column(nullable = false, length = 80)
    private String country;
    @Column(length = 15)
    private String postalCode;
    @Column(name = "is_primary", nullable = false)
    private boolean primaryAddress;
}
