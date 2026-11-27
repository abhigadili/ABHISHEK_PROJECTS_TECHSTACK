package com.hospital.hospital.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "departments", uniqueConstraints = @UniqueConstraint(name = "uk_department_hospital_name", columnNames = {"hospital_id", "name"}))
public class Department {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "hospital_id", nullable = false, foreignKey = @ForeignKey(name = "fk_department_hospital"))
    private Hospital hospital;
    @Column(nullable = false, length = 100)
    private String name;
    @Column(length = 255)
    private String description;
    @Column(nullable = false)
    private boolean active = true;
}
