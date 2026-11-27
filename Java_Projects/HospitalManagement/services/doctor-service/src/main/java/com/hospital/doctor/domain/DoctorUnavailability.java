package com.hospital.doctor.domain;

import java.time.LocalDate;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** A full day off (leave, conference...). */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "doctor_unavailability", uniqueConstraints = @UniqueConstraint(name = "uk_unavailable_doctor_date", columnNames = {"doctor_id", "unavailableDate"}))
public class DoctorUnavailability {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "doctor_id", nullable = false, foreignKey = @ForeignKey(name = "fk_unavailable_doctor"))
    private Doctor doctor;
    @Column(nullable = false)
    private LocalDate unavailableDate;
    @Column(length = 200)
    private String reason;
}
