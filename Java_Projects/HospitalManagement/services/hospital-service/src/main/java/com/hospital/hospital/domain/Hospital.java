package com.hospital.hospital.domain;

import java.time.Instant;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "hospitals", uniqueConstraints = @UniqueConstraint(name = "uk_hospital_code", columnNames = "code"),
        indexes = @Index(name = "idx_hospital_city", columnList = "city"))
public class Hospital {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false, length = 150)
    private String name;
    @Column(nullable = false, length = 30)
    private String code;
    @Column(length = 255)
    private String address;
    @Column(length = 80)
    private String city;
    @Column(length = 30)
    private String phone;
    @Column(length = 120)
    private String email;
    @Column(nullable = false)
    private boolean active = true;
    @Column(nullable = false, updatable = false)
    private Instant createdAt = Instant.now();
}
