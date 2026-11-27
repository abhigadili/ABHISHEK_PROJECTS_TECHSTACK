package com.hrportal.employee.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Embeddable value object: its columns live in the employees table. */
@Getter
@Setter
@NoArgsConstructor
@Embeddable
public class ContactInfo {
    @Column(length = 20)
    private String phone;
    @Column(length = 20)
    private String alternatePhone;
    @Column(length = 150)
    private String personalEmail;
}
