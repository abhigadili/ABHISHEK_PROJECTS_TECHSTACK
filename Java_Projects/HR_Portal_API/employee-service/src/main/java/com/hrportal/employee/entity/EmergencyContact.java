package com.hrportal.employee.entity;

import com.hrportal.common.persistence.BaseEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "emergency_contacts")
public class EmergencyContact extends BaseEntity {
    @Column(nullable = false, length = 120)
    private String name;
    @Column(nullable = false, length = 50)
    private String relationship;
    @Column(nullable = false, length = 20)
    private String phone;
    @Column(length = 20)
    private String alternatePhone;
    @Column(length = 150)
    private String email;
    @Column(name = "is_primary", nullable = false)
    private boolean primaryContact;
}
